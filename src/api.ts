import type { ModelConfigKey } from './config/credentials';
import type { AndroidDevice, AppiumVersionInfo, AppPreset, ConfigForm, DeviceLock, DeviceSession, OperationRecord, OperationEvent } from './types';

export const APP_BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

// 统一解析接口响应，并把后端 message 转成前端可直接展示的 Error。
async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message || '请求失败');
  }
  return payload;
}

// 项目内大部分接口都是 JSON POST，这里集中处理请求头和错误转换。
async function postJson<T>(url: string, body?: unknown, options: { signal?: AbortSignal } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify(body || {}),
  }).catch((error) => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new Error(`无法连接本地后端 ${url}：${error instanceof Error ? error.message : '网络请求失败'}`);
  });
  return readJson<T>(response);
}

export async function getAppiumVersion() {
  const response = await fetch(`${APP_BASE}/api/appium-version`, { signal: AbortSignal.timeout(8000) });
  return readJson<AppiumVersionInfo>(response);
}

// 读取模型配置和脚本优化模型配置。
export async function getConfig() {
  const response = await fetch(`${APP_BASE}/api/config`);
  return readJson<ConfigForm>(response);
}

export function revealModelApiKey(input: { modelKey: ModelConfigKey; baseUrl: string; provider?: string }, signal: AbortSignal) {
  return postJson<{ apiKey: string }>(`${APP_BASE}/api/config/model-key`, input, { signal });
}

// 运行配置独立保存，不携带尚未测试的模型草稿。
export function saveConfig(input: Pick<ConfigForm, 'runtime'>) {
  return postJson<{ success?: boolean } | ConfigForm>(`${APP_BASE}/api/config`, input);
}

export function saveAppiumConfig(appium: Omit<ConfigForm['appium'], 'model' | 'promptOptimizer'>) {
  return postJson<{ success: boolean }>(`${APP_BASE}/api/config/appium`, { appium });
}

// 测试指定模型配置是否可用，通常用于保存前验证 baseUrl/apiKey/model。
export function testModel(input: {
  save?: boolean;
  modelKey: 'appium' | 'promptOptimizer';
  model: {
    provider?: string;
    baseUrl: string;
    apiKey: string;
    name: string;
    family?: string;
  };
}) {
  return postJson<{
    saved?: boolean;
    content?: string;
    durationMs?: number;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  }>(`${APP_BASE}/api/test-model`, input);
}

// 读取预设 App 列表，测试脚本生成时用于自动拼接 App 名称和包名上下文。
export async function getAppPresets() {
  const response = await fetch(`${APP_BASE}/api/app-presets`);
  return readJson<{ apps?: AppPreset[] }>(response);
}

// 新增或更新预设 App；同名或同包名校验由后端负责。
export function saveAppPreset(input: { id?: string; name: string; packageName: string }) {
  return postJson<{ app?: AppPreset }>(`${APP_BASE}/api/save-app-preset`, input);
}

// 删除一个预设 App 配置。
export function deleteAppPreset(input: { id: string }) {
  return postJson<{ success?: boolean }>(`${APP_BASE}/api/delete-app-preset`, input);
}

// 读取 ADB 设备列表，并让后端确保当前设备会话存在。
export async function getAndroidDevices() {
  const response = await fetch(`${APP_BASE}/api/android-devices`);
  return readJson<{ devices?: AndroidDevice[]; currentDeviceId?: string }>(response);
}

// 读取后端缓存的设备会话状态，用于排查页面切换后是否复用同一设备连接。
export async function getDeviceSessions() {
  const response = await fetch(`${APP_BASE}/api/device-sessions`);
  return readJson<{ sessions?: DeviceSession[] }>(response);
}

// 读取当前活跃设备锁，用于排查是否有脚本执行占用某台手机。
export async function getDeviceLocks() {
  const response = await fetch(`${APP_BASE}/api/device-locks`);
  return readJson<{ locks?: DeviceLock[] }>(response);
}

// 读取脚本执行记录列表，包含执行状态、设备、脚本名和结果摘要。
export async function getOperations(limit = 30) {
  const response = await fetch(`${APP_BASE}/api/operations?limit=${encodeURIComponent(String(limit))}`);
  return readJson<{ operations?: OperationRecord[] }>(response);
}

// 读取单次脚本执行详情和事件流，便于查看输出、步骤事件和失败原因。
export async function getOperation(operationId: string) {
  const response = await fetch(`${APP_BASE}/api/operations/${encodeURIComponent(operationId)}`);
  return readJson<{ operation?: OperationRecord; events?: OperationEvent[] }>(response);
}

// 读取 Android 设备分辨率，用于把预览区域坐标映射到真实设备坐标。
export async function getAndroidDisplayInfo(deviceId: string) {
  const response = await fetch(`${APP_BASE}/api/android-display-info?deviceId=${encodeURIComponent(deviceId)}`);
  return readJson<{ width?: number; height?: number }>(response);
}

export function setAndroidDevice(input: { deviceId: string }) {
  return postJson<{ currentDeviceId?: string }>(`${APP_BASE}/api/android-device`, input);
}

// 向 Android 设备发送 tap 坐标，用于设备预览中的鼠标/触摸点击。
export function tapAndroid(input: { deviceId: string; x: number; y: number }) {
  return postJson<{ success?: boolean; message?: string }>(`${APP_BASE}/api/android-tap`, input);
}

// 向 Android 设备发送 swipe 手势，用于设备预览中的拖动操作。
export function swipeAndroid(input: {
  deviceId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
}) {
  return postJson<{ success?: boolean; message?: string }>(`${APP_BASE}/api/android-swipe`, input);
}

// 向 Android 设备发送系统按键，例如返回、Home、任务、音量、电源等。
export function sendAndroidKeyevent(input: { deviceId: string; keyCode: number }) {
  return postJson<{ success?: boolean; message?: string }>(`${APP_BASE}/api/android-keyevent`, input);
}

// 停止当前脚本执行进程；后端会中止运行并释放设备锁。
export async function getTestAnalytics(days = 0) {
  const response = await fetch(`${APP_BASE}/api/analytics?days=${days}`, { signal: AbortSignal.timeout(15000) });
  return readJson<import('./analytics/summary').AnalysisResponse>(response);
}
