import { handleNativeMidsceneRequest } from './native-midscene';
import { handleAutonomousRequest } from '../ai-task/server/routes';
import { getTestAnalytics } from './analytics';
import { readBody, requestErrorStatus, RequestBodyError } from './request-body';
import { canManageConfig, publicConfig, resolveSavedModelKey } from './config-access';
import { SAVED_API_KEY } from '../src/config/credentials';
import { resolveReportSummary } from '../src/appium-recorder/report-summary';
// The application HTTP API — extracted from vite.config.ts so the exact
// same middleware serves the standalone dev/preview flow AND the DSH plugin.
// It is a Connect-style handler: (req, res, next). Callers that have no next
// stage (the DSH plugin) provide their own (e.g. static SPA serving).
import type { IncomingMessage, ServerResponse } from 'node:http';

type NextFunction = (err?: unknown) => void;
type NextHandleFunction = (req: IncomingMessage, res: ServerResponse, next: NextFunction) => void;

import { execFile } from 'node:child_process';
import { ConfigValidationError, loadConfig, saveConfig, type AppConfig } from './config';
import { listAppPresetRecords, removeAppPresetRecord, saveAppPresetRecord } from './config-store';
import { testModelConnection } from './model-tester';
import { listActiveDeviceLocks } from './device-locks/service';
import { ensureDeviceSession, listDeviceSessions } from './device-sessions/service';
import {
  finishScriptRunOperation,
  getOperationWithEvents,
  listOperations,
  recordOperationEvent,
  startScriptRunOperation,
} from './operations/service';
import { handleAppiumRecorderRequest } from './appium-recorder/routes';
import { handleAiFlowRequest } from '../ai-flow/server/routes';
import { isFlowGenerationRunning } from '../ai-flow/server/tasks';
import { getAppiumVersion } from './appium-recorder/managed-appium';
import { handleRemoteAgentRequest } from './remote-agents/routes';
import { isRemoteDeviceId, listRemoteAndroidDevices, sendRemoteCommand } from './remote-agents/registry';
import { getAdbCommand } from './android-sdk';
import { readAndroidDeviceInfo } from './android-device-info';
import { handleIosRequest, listIosDevices } from './ios/routes';
import { isIosDevice } from './ios/devices';
import { iosClient, withIosControl } from './ios/wda-client';

function execFileText(command: string, args: string[] = []) {
  return new Promise<string>((resolve, reject) => {
    execFile(command, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

function execFileJson(command: string, args: string[] = []) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(command, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

type AndroidDevice = {
  id: string;
  platform: 'android';
  status: string;
  description: string;
};

type AndroidDisplayInfo = {
  width: number;
  height: number;
};

async function listAdbDevices() {
  const output = await execFileText(getAdbCommand(), ['devices', '-l']);
  const devices = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => {
      const parts = line.split(/\s+/);
      const id = parts[0] || '';
      const status = parts[1] || 'unknown';
      const model = parts.find((part) => part.startsWith('model:'))?.slice(6) || '';
      const device = parts.find((part) => part.startsWith('device:'))?.slice(7) || '';
      return {
        id,
        platform: 'android' as const,
        status,
        description: [model, device].filter(Boolean).join(' · ') || status,
      } satisfies AndroidDevice;
    })
    .filter((device) => device.id);

  return devices;
}

async function getAdbDisplayInfo(deviceId: string) {
  const output = await execFileText(getAdbCommand(), ['-s', deviceId, 'shell', 'wm', 'size']);
  const match = output.match(/Override size:\s*(\d+)x(\d+)/i) || output.match(/Physical size:\s*(\d+)x(\d+)/i);

  if (!match) {
    throw new Error('读取设备分辨率失败');
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  } satisfies AndroidDisplayInfo;
}

function getRequestedDeviceId(req: IncomingMessage) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get('deviceId')?.trim() || '';
}

function getCookie(req: IncomingMessage, name: string) {
  const cookie = req.headers.cookie || '';
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

function setCookie(res: ServerResponse, value: string) {
  const existing = res.getHeader('Set-Cookie');
  const next = `qualix_client_id=${value}; Path=/; SameSite=Lax`;
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, next]);
  } else if (existing) {
    res.setHeader('Set-Cookie', [String(existing), next]);
  } else {
    res.setHeader('Set-Cookie', next);
  }
}

function isLocalRequest(req: IncomingMessage) {
  const address = req.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function assertDeviceAllowedForRequest(req: IncomingMessage, deviceId: string) {
  if (req.method === 'POST' && ['/api/android-tap', '/api/android-keyevent', '/api/android-swipe'].includes(req.url || '') && isFlowGenerationRunning(deviceId)) {
    throw new Error('该设备正在 AI 生成流程，请先停止生成或等待完成');
  }
  if (!isLocalRequest(req) && deviceId && !isRemoteDeviceId(deviceId)) {
    throw new Error('局域网访问者只能使用远程代理设备');
  }
}

export function createApiMiddleware() {
  const selectedDeviceByClient = new Map<string, string>();
  const getClientId = (req: IncomingMessage, res: ServerResponse) => {
    const existing = getCookie(req, 'qualix_client_id');
    if (existing) return existing;
    const next = `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    setCookie(res, next);
    return next;
  };

  const getSelectedDeviceId = (req: IncomingMessage, res: ServerResponse) => {
    return selectedDeviceByClient.get(getClientId(req, res)) || '';
  };

  const setSelectedDeviceId = (req: IncomingMessage, res: ServerResponse, deviceId: string) => {
    selectedDeviceByClient.set(getClientId(req, res), deviceId);
  };

  const listVisibleAndroidDevices = async (req: IncomingMessage) => {
    const ios = isLocalRequest(req) ? await listIosDevices() : [];
    const localDevices = isLocalRequest(req) ? await listAdbDevices().catch(error => {
      if (ios.length) return [];
      throw error;
    }) : [];
    return [...localDevices, ...listRemoteAndroidDevices(), ...ios];
  };

  const handler: NextHandleFunction = async (req, res, next) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = requestUrl.pathname;
    const allowLocalDevice = isLocalRequest(req);
    if ((pathname === '/api/config' || pathname.startsWith('/api/config/') || pathname === '/api/test-model') && !canManageConfig(req)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ message: '参数配置仅允许在本机页面访问' }));
      return;
    }
    let selectedDeviceId = getSelectedDeviceId(req, res);
    if (!allowLocalDevice && selectedDeviceId && !isRemoteDeviceId(selectedDeviceId)) {
      selectedDeviceId = '';
      setSelectedDeviceId(req, res, selectedDeviceId);
    }

    if (await handleNativeMidsceneRequest(req,res)) return;

    if (await handleAutonomousRequest(req,res)) return;

    if (await handleRemoteAgentRequest(req, res)) {
      return;
    }

    if (await handleAiFlowRequest(req, res, allowLocalDevice)) {
      return;
    }

    if (await handleIosRequest(req, res, allowLocalDevice)) return;

    if (await handleAppiumRecorderRequest(req, res, selectedDeviceId, allowLocalDevice)) {
      return;
    }

    if (req.url?.startsWith('/api/device-sessions') && req.method === 'GET') {
      try {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ sessions: listDeviceSessions() }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : '读取设备会话失败' }));
      }
      return;
    }

    if (req.url?.startsWith('/api/device-locks') && req.method === 'GET') {
      try {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ locks: listActiveDeviceLocks() }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : '读取设备锁失败' }));
      }
      return;
    }

    if (req.url?.startsWith('/api/operations') && req.method === 'GET') {
      try {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const operationId = requestUrl.pathname.split('/').filter(Boolean)[2] || '';
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (operationId) {
          const detail = getOperationWithEvents(operationId);
          if (!detail) {
            res.statusCode = 404;
            res.end(JSON.stringify({ message: '执行记录不存在' }));
            return;
          }
          res.end(JSON.stringify(detail));
          return;
        }
        const limit = Number(requestUrl.searchParams.get('limit') || 30);
        res.end(JSON.stringify({ operations: listOperations(limit) }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : '读取执行记录失败' }));
      }
      return;
    }

    if (pathname === '/api/analytics' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      try {
        const days = Number(requestUrl.searchParams.get('days') || 0);
        if (![0, 7, 30, 90].includes(days)) { res.statusCode = 400; res.end(JSON.stringify({ message: '请选择有效的统计范围' })); return; }
        res.end(JSON.stringify(getTestAnalytics(days)));
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : '统计数据加载失败' }));
      }
      return;
    }

    if (pathname === '/api/appium-version' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(await getAppiumVersion()));
      return;
    }

    if (req.url === '/api/config' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(publicConfig(loadConfig())));
      return;
    }

    if (pathname === '/api/config/model-key' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      try {
        const input = await readBody<{ modelKey?: unknown; baseUrl?: unknown; provider?: unknown }>(req);
        if (typeof input.modelKey !== 'string' || !['appium','promptOptimizer'].includes(input.modelKey)
          || typeof input.baseUrl !== 'string' || (input.provider !== undefined && typeof input.provider !== 'string')) {
          throw new RequestBodyError('请选择有效的模型配置', 400);
        }
        const config = loadConfig();
        const stored = input.modelKey === 'promptOptimizer' ? config.appium.promptOptimizer?.model
          : config[input.modelKey as 'appium'].model;
        const apiKey = resolveSavedModelKey({ apiKey: SAVED_API_KEY, baseUrl: input.baseUrl, provider: input.provider as string | undefined }, stored);
        if (!apiKey) throw new RequestBodyError('尚未保存 API Key，请先输入并测试保存', 400);
        res.end(JSON.stringify({ apiKey }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error, 400);
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : '无法显示 API Key' }));
      }
      return;
    }

    if ((req.url === '/api/config' || req.url === '/api/config/appium') && req.method === 'POST') {
      try {
        const parsed = await readBody<Partial<AppConfig>>(req);
        if (req.url === '/api/config/appium' && (!parsed.appium || typeof parsed.appium !== 'object' || Array.isArray(parsed.appium))) {
          throw new ConfigValidationError('测试编排配置无效');
        }
        const current = loadConfig();
        const config = req.url === '/api/config/appium'
          ? { ...current, appium: { ...current.appium, ...parsed.appium, model: current.appium.model, promptOptimizer: current.appium.promptOptimizer,
            reportSummary: { ...resolveReportSummary(current.appium.reportSummary), ...parsed.appium?.reportSummary } } }
          : { ...current, runtime: parsed.runtime ?? current.runtime };
        saveConfig(config);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error, error instanceof ConfigValidationError ? 400 : 500);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url?.startsWith('/api/android-devices') && req.method === 'GET') {
      try {
        const devices = await listVisibleAndroidDevices(req);
        const onlineDevices = devices.filter((device) => device.status === 'device');
        if (!onlineDevices.some((device) => device.id === selectedDeviceId)) {
          selectedDeviceId = onlineDevices[0]?.id || devices[0]?.id || '';
          setSelectedDeviceId(req, res, selectedDeviceId);
        }
        if (selectedDeviceId) {
          ensureDeviceSession({ deviceId: selectedDeviceId });
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ devices, currentDeviceId: selectedDeviceId }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url === '/api/android-device' && req.method === 'POST') {
      try {
        const parsed = await readBody<{ deviceId?: string }>(req);
        const devices = await listVisibleAndroidDevices(req);
        const exists = devices.some((device) => device.id === parsed.deviceId);
        if (!exists) {
          throw new Error('设备不存在或已断开');
        }
        selectedDeviceId = parsed.deviceId || '';
        setSelectedDeviceId(req, res, selectedDeviceId);
        ensureDeviceSession({ deviceId: selectedDeviceId });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, currentDeviceId: selectedDeviceId }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url?.startsWith('/api/android-preview') && req.method === 'GET') {
      try {
        const deviceId = getRequestedDeviceId(req) || selectedDeviceId;
        if (!deviceId) {
          throw new Error('未检测到可用设备');
        }
        assertDeviceAllowedForRequest(req, deviceId);

        if (isIosDevice(deviceId)) {
          const client = iosClient(deviceId); const release = await client.retain();
          try { res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'no-store'); res.end(await client.screenshot()); }
          finally { release(); }
          return;
        }
        if (isRemoteDeviceId(deviceId)) {
          const data = await sendRemoteCommand(deviceId, 'screenshot') as { base64?: string };
          if (!data.base64) throw new Error('远程设备预览不可用');
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          res.end(Buffer.from(data.base64, 'base64'));
          return;
        }

        execFile(getAdbCommand(), ['-s', deviceId, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ message: stderr || error.message || '设备预览不可用' }));
            return;
          }
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          res.end(stdout);
        });
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url === '/api/android-tap' && req.method === 'POST') {
      try {
        const parsed = await readBody<{ deviceId?: string; x?: number; y?: number }>(req);
        const deviceId = parsed.deviceId || selectedDeviceId;
        const x = Math.round(Number(parsed.x));
        const y = Math.round(Number(parsed.y));
        if (!deviceId) {
          throw new Error('未检测到可用设备');
        }
        assertDeviceAllowedForRequest(req, deviceId);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new Error('点击坐标无效');
        }
        if (isIosDevice(deviceId)) {
          throw new RequestBodyError('iOS 点击需要画面版本，请使用 iOS 控制接口', 400);
        }
        if (isRemoteDeviceId(deviceId)) {
          const result = await sendRemoteCommand(deviceId, 'tap', { x, y });
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, result }));
          return;
        }
        const result = await execFileJson(getAdbCommand(), ['-s', deviceId, 'shell', 'input', 'tap', String(x), String(y)]);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url === '/api/android-keyevent' && req.method === 'POST') {
      try {
        const parsed = await readBody<{ deviceId?: string; keyCode?: number }>(req);
        const deviceId = parsed.deviceId || selectedDeviceId;
        const keyCode = Math.round(Number(parsed.keyCode));
        if (!deviceId) {
          throw new Error('未检测到可用设备');
        }
        assertDeviceAllowedForRequest(req, deviceId);
        if (!Number.isFinite(keyCode)) {
          throw new Error('按键无效');
        }
        if (isIosDevice(deviceId)) {
          await withIosControl(deviceId, client => client.key(keyCode));
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true })); return;
        }
        if (isRemoteDeviceId(deviceId)) {
          const result = await sendRemoteCommand(deviceId, 'key', { keyCode });
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, result }));
          return;
        }
        const result = await execFileJson(getAdbCommand(), ['-s', deviceId, 'shell', 'input', 'keyevent', String(keyCode)]);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url?.startsWith('/api/android-device-info') && req.method === 'GET') {
      try {
        const deviceId = getRequestedDeviceId(req) || selectedDeviceId;
        if (!deviceId) throw new Error('未检测到可用设备');
        assertDeviceAllowedForRequest(req, deviceId);
        const details = isIosDevice(deviceId)
          ? { name: iosClient(deviceId).config.name, brand: 'Apple', model: 'iOS', processor: '-', androidVersion: '-', physicalResolution: '-', resolution: '-' }
          : isRemoteDeviceId(deviceId)
          ? await sendRemoteCommand(deviceId, 'deviceInfo')
          : await readAndroidDeviceInfo(deviceId, getAdbCommand());
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ deviceId, details }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : '读取设备信息失败' }));
      }
      return;
    }

    if (req.url?.startsWith('/api/android-display-info') && req.method === 'GET') {
      try {
        const deviceId = getRequestedDeviceId(req) || selectedDeviceId;
        if (!deviceId) {
          throw new Error('未检测到可用设备');
        }
        assertDeviceAllowedForRequest(req, deviceId);
        if (isIosDevice(deviceId)) {
          const client = iosClient(deviceId); const release = await client.retain();
          try { const size = await client.size(); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ deviceId, ...size })); }
          finally { release(); }
          return;
        }
        if (isRemoteDeviceId(deviceId)) {
          const displayInfo = await sendRemoteCommand(deviceId, 'displayInfo') as AndroidDisplayInfo;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ deviceId, ...displayInfo }));
          return;
        }
        const displayInfo = await getAdbDisplayInfo(deviceId);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ deviceId, ...displayInfo }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url === '/api/android-swipe' && req.method === 'POST') {
      try {
        const parsed = await readBody<{
          deviceId?: string;
          startX?: number;
          startY?: number;
          endX?: number;
          endY?: number;
          duration?: number;
        }>(req);
        const deviceId = parsed.deviceId || selectedDeviceId;
        const startX = Math.round(Number(parsed.startX));
        const startY = Math.round(Number(parsed.startY));
        const endX = Math.round(Number(parsed.endX));
        const endY = Math.round(Number(parsed.endY));
        const duration = Math.max(80, Math.round(Number(parsed.duration) || 160));
        if (!deviceId) {
          throw new Error('未检测到可用设备');
        }
        assertDeviceAllowedForRequest(req, deviceId);
        if (![startX, startY, endX, endY].every(Number.isFinite)) {
          throw new Error('滑动坐标无效');
        }
        if (isIosDevice(deviceId)) {
          throw new RequestBodyError('iOS 滑动需要画面版本，请使用 iOS 控制接口', 400);
        }
        if (isRemoteDeviceId(deviceId)) {
          const result = await sendRemoteCommand(deviceId, 'swipe', { startX, startY, endX, endY, duration });
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, result }));
          return;
        }
        const result = await execFileJson(
          getAdbCommand(),
          ['-s', deviceId, 'shell', 'input', 'swipe', String(startX), String(startY), String(endX), String(endY), String(duration)],
        );
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url === '/api/test-model' && req.method === 'POST') {
      try {
        const parsed = await readBody<{
          save?: boolean;
          modelKey?: 'appium' | 'promptOptimizer';
          model?: {
            provider?: string;
            baseUrl?: string;
            apiKey?: string;
            name?: string;
            family?: string;
          };
        }>(req);
        const model = { ...parsed.model };
        const stored = loadConfig();
        const savedModel = parsed.modelKey === 'promptOptimizer' ? stored.appium.promptOptimizer?.model
          : parsed.modelKey && ['appium'].includes(parsed.modelKey) ? stored[parsed.modelKey as 'appium'].model : undefined;
        model.apiKey = resolveSavedModelKey(model, savedModel);

        if (parsed.save && !['appium', 'promptOptimizer'].includes(parsed.modelKey || '')) {
          throw new ConfigValidationError('请选择有效的模型配置');
        }

        const result = await testModelConnection({
          provider: model.provider,
          baseUrl: model.baseUrl || '',
          apiKey: model.apiKey || '',
          name: model.name || '',
          family: model.family || '',
        });
        if (parsed.save) {
          if (!result.ok) throw new Error('模型测试失败，未保存配置');
          const key = parsed.modelKey!;
          // 测试期间其他配置可能已保存，此时重新读取，只更新已通过测试的模型。
          const current = loadConfig();
          if (key === 'promptOptimizer') {
            saveConfig({ ...current, appium: { ...current.appium, promptOptimizer: { model: { baseUrl: model.baseUrl || '', apiKey: model.apiKey || '', name: model.name || '' } } } });
          } else saveConfig({ ...current, [key]: { ...current[key], model: { ...current[key].model, ...model } } });
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ...result, saved: parsed.save === true }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url === '/api/app-presets' && req.method === 'GET') {
      try {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ apps: listAppPresetRecords() }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' }));
      }
      return;
    }

    if (req.url === '/api/save-app-preset' && req.method === 'POST') {
      try {
        const parsed = await readBody<{ id?: string; name?: string; packageName?: string; platform?: unknown }>(req);
        const app = saveAppPresetRecord({
          id: parsed.id,
          name: parsed.name || '',
          packageName: parsed.packageName || '',
          platform: parsed.platform,
        });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ app }));
      } catch (error) {
        res.statusCode = requestErrorStatus(error, 400);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : '保存 App 配置失败' }));
      }
      return;
    }

    if (req.url === '/api/delete-app-preset' && req.method === 'POST') {
      try {
        const parsed = await readBody<{ id?: string }>(req);
        if (!parsed.id) throw new Error('App ID 不能为空');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(removeAppPresetRecord(parsed.id)));
      } catch (error) {
        res.statusCode = requestErrorStatus(error, 400);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : '删除 App 配置失败' }));
      }
      return;
    }

    next();
  };
  return handler;
}
