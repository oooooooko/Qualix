import type { IncomingMessage, ServerResponse } from 'node:http';
import { iosDevices, saveIosDevices, iosConnectionCandidates } from './devices';
import { iosClient, withIosControl, assertIosConfigurationIdle } from './wda-client';
import { closeIosPreview, createIosPreview, iosPreviewSession, streamIosPreview } from './preview';
import { readBody, requestErrorStatus, RequestBodyError } from '../request-body';
import type { IosDeviceConfig } from '../../src/ios/types';
import { canManageConfig } from '../config-access';
import { DEFAULT_IOS_DEVICE, wdaAddressKey } from '../../src/ios/connection';

export async function listIosDevices() {
  const configured = iosDevices();
  const devices = await Promise.all(iosConnectionCandidates(configured).map(async device => {
    const online = await iosClient(device.id).online();
    if (!online && !configured.some(item => item.id === device.id)) return null;
    return { id: device.id, platform: 'ios' as const, status: online ? 'device' : 'offline', description: device.name };
  }));
  return devices.filter(device => device !== null);
}
export async function handleIosRequest(req: IncomingMessage, res: ServerResponse, allowLocal: boolean) {
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  if (!path.startsWith('/api/ios/')) return false;
  const send = (body: unknown, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  try {
    if (!allowLocal || !canManageConfig(req)) throw new RequestBodyError('iOS WDA 设备仅允许本机访问', 403);
    if (path === '/api/ios/discovery' && req.method === 'GET') {
      const devices = await listIosDevices();
      const local = iosConnectionCandidates().find(device => wdaAddressKey(device.wdaBaseUrl) === wdaAddressKey(DEFAULT_IOS_DEVICE.wdaBaseUrl));
      send({ devices, defaultDeviceId: local?.id || '' }); return true;
    }
    if (path.startsWith('/api/ios/control/') && req.method === 'POST') {
      const input = await readBody<{ deviceId: string; geometryRevision?: number; x: number; y: number; startX: number; startY: number; endX: number; endY: number; duration: number; keyCode: number }>(req);
      await withIosControl(input.deviceId, async client => {
        const geometry = await client.size();
        if (!path.endsWith('/key') && input.geometryRevision !== geometry.revision) throw new RequestBodyError('设备画面尺寸已变化，请刷新画面后重试', 409);
        if (path.endsWith('/tap')) await client.tap(input.x, input.y);
        else if (path.endsWith('/swipe')) await client.swipe(input.startX, input.startY, input.endX, input.endY, input.duration || 400);
        else if (path.endsWith('/key')) await client.key(input.keyCode);
        else throw new RequestBodyError('iOS 控制操作不存在', 404);
      });
      send({ success: true }); return true;
    }
    if (path === '/api/ios/devices') {
      if (req.method === 'GET') { send({ devices: iosDevices() }); return true; }
      if (req.method === 'POST') { const body = await readBody<{ devices: IosDeviceConfig[] }>(req); if (!Array.isArray(body.devices)) throw new RequestBodyError('iOS 设备配置格式无效', 400); assertIosConfigurationIdle(body.devices); saveIosDevices(body.devices); send({ success: true }); return true; }
    }
    if (path === '/api/ios/preview/sessions' && req.method === 'POST') {
      const { deviceId } = await readBody<{ deviceId: string }>(req);
      const preview = await createIosPreview(deviceId);
      if (res.destroyed) closeIosPreview(preview.previewSessionId);
      else send(preview);
      return true;
    }
    const match = path.match(/^\/api\/ios\/preview\/sessions\/([\w-]+)(?:\/(stream|frame|status))?$/);
    if (match) {
      if (req.method === 'DELETE' && !match[2]) { closeIosPreview(match[1]); send({ success: true }); return true; }
      const session = iosPreviewSession(match[1]);
      if (req.method === 'GET' && match[2] === 'stream') { await streamIosPreview(match[1], res); return true; }
      if (req.method === 'GET' && match[2] === 'frame') {
        res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'no-store');
        res.end(await session.client.screenshot()); return true;
      }
      if (req.method === 'GET' && match[2] === 'status') {
        // Return cached geometry during control/source requests instead of
        // queuing another WDA command behind a potentially long native action.
        if (!session.client.busy) {
          try {
            session.description.geometry = await session.client.size();
            if (session.description.status === 'unavailable') session.description.status = 'reconnecting';
          } catch (error) {
            session.description.status = await session.client.online() ? 'reconnecting' : 'unavailable';
            session.description.error = error instanceof Error ? error.message : 'iOS 状态暂不可用';
          }
        }
        send(session.description); return true;
      }
    }
    throw new RequestBodyError('iOS 接口不存在', 404);
  } catch (error) {
    if (res.headersSent) res.end();
    else send({ message: error instanceof Error ? error.message : 'iOS 连接失败' }, requestErrorStatus(error, 502));
    return true;
  }
}
