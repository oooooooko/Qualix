import sharp from 'sharp';
import { iosDevice, iosConnectionCandidates } from './devices';
import type { IosDeviceConfig, IosGeometry } from '../../src/ios/types';
import { acquireDeviceLock, releaseDeviceLock } from '../device-locks/service';
import { RequestBodyError } from '../request-body';
import { DeviceLockConflictError } from '../device-locks/types';
import { wdaAddressKey } from '../../src/ios/connection';

export class WdaError extends Error {
  constructor(message: string, readonly status: number, readonly code = '') { super(message); }
}

export class WdaClient {
  sessionId = '';
  owned = false;
  geometry: IosGeometry = { width: 0, height: 0, revision: 0, coordinateSpace: 'wda-points' };
  private connecting?: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  private references = 0;
  private pending = 0;
  private closing?: Promise<void>;
  private healthy = false;
  private lastReachableAt = 0;
  private healthFailures = 0;
  private checking?: Promise<boolean>;
  constructor(public config: IosDeviceConfig) {}
  get active() { return this.references > 0 || this.busy; }
  get busy() { return this.pending > 0 || Boolean(this.connecting); }

  private reached() {
    this.healthy = true;
    this.lastReachableAt = Date.now();
    this.healthFailures = 0;
  }

  async online(): Promise<boolean> {
    // WDA serializes native operations. A health probe would queue behind them.
    if (this.healthy && this.busy && Date.now() - this.lastReachableAt < 90000) return true;
    if (!this.checking) this.checking = (async () => {
      try {
        const status = await this.raw<{ value?: { ready?: boolean } }>('/status', {}, 3000);
        if (status.value?.ready === true) this.reached();
        else { this.healthy = false; this.healthFailures = 0; }
      } catch {
        this.healthFailures++;
        if (this.healthFailures >= 3 && Date.now() - this.lastReachableAt >= 15000) this.healthy = false;
      }
      return this.healthy;
    })().finally(() => { this.checking = undefined; });
    return this.checking;
  }

  async raw<T = unknown>(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    const response = await fetch(`${this.config.wdaBaseUrl.replace(/\/+$/, '')}${path}`, {
      ...init, signal, redirect: 'error', headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    const data = await response.json() as { value?: { error?: string; message?: string } };
    if (!response.ok || data.value?.error) {
      if (data.value?.error) this.reached(); // A WDA command error is not a disconnected device.
      throw new WdaError(data.value?.message || `WDA 请求失败（${response.status}）`, response.status, data.value?.error);
    }
    if (path !== '/status') this.reached();
    return data as T;
  }

  async ensure() {
    await this.closing;
    if (this.sessionId) return;
    if (!this.connecting) this.connecting = (async () => {
      const status = await this.raw<{ sessionId?: string; value?: { ready?: boolean; sessionId?: string } }>('/status', {}, 10000);
      if (status.value?.ready !== true) throw new WdaError('WDA 尚未准备就绪', 503);
      this.reached();
      if (this.config.sessionId) { this.sessionId = this.config.sessionId; this.owned = false; }
      else if (status.sessionId || status.value.sessionId) {
        this.sessionId = status.sessionId || status.value.sessionId!;
        this.owned = false;
      }
      else {
        const result = await this.raw<{ sessionId?: string; value?: { sessionId?: string } }>('/session', {
          method: 'POST', body: JSON.stringify({ capabilities: { alwaysMatch: { platformName: 'iOS', automationName: 'XCUITest', shouldWaitForQuiescence: false } } }),
        }, 30000);
        this.sessionId = result.sessionId || result.value?.sessionId || '';
        if (!this.sessionId) throw new WdaError('WDA 未返回 sessionId', 502);
        this.owned = true;
      }
      await this.raw(`/session/${this.sessionId}/appium/settings`, { method: 'POST', body: JSON.stringify({ settings: { mjpegServerFramerate: 30, mjpegServerScreenshotQuality: 50, mjpegScalingFactor: 50 } }) }).catch(() => {});
    })().finally(() => { this.connecting = undefined; });
    return this.connecting;
  }

  async retain() {
    this.references++;
    try { await this.ensure(); } catch (error) { this.release(); throw error; }
    let released = false;
    return () => { if (!released) { released = true; this.release(); } };
  }
  private release() {
    this.references = Math.max(0, this.references - 1);
    // Keep the session across preview visibility changes, recording and replay.
    // Only explicit shutdown closes a session created by this process.
  }
  async close() {
    if (this.closing) return this.closing;
    if (this.references) return;
    if (this.busy) {
      await this.tail.catch(() => {});
      await this.connecting?.catch(() => {});
      return this.close();
    }
    const session = this.sessionId;
    this.sessionId = '';
    const owned = this.owned;
    this.owned = false;
    this.closing = (async () => {
      if (owned && session) await this.raw(`/session/${session}`, { method: 'DELETE' }, 2000).catch(() => {});
    })();
    try { await this.closing; } finally { this.closing = undefined; }
  }

  async request<T = { value: unknown }>(path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
    this.pending++;
    const task = this.tail.catch(() => {}).then(async () => {
      init.signal?.throwIfAborted();
      await this.ensure();
      try { return await this.raw<T>(`/session/${this.sessionId}${path}`, init, timeoutMs); }
      catch (error) {
        // An invalid-session response proves the command was rejected before
        // execution. Never replay an action after an ambiguous transport timeout.
        if (!(error instanceof WdaError) || error.code !== 'invalid session id' || this.config.sessionId) throw error;
        init.signal?.throwIfAborted();
        this.sessionId = '';
        this.owned = false;
        await this.ensure();
        return this.raw<T>(`/session/${this.sessionId}${path}`, init, timeoutMs);
      }
    }).finally(() => { this.pending--; });
    this.tail = task;
    return task;
  }
  async size(signal?: AbortSignal) {
    const { value } = await this.request<{ value: { width: number; height: number } }>('/window/size', { signal });
    if (!(value.width > 0 && value.height > 0)) throw new WdaError('WDA 屏幕尺寸无效', 502);
    if (value.width !== this.geometry.width || value.height !== this.geometry.height) this.geometry = { ...this.geometry, ...value, revision: this.geometry.revision + 1 };
    return this.geometry;
  }
  async screenshot(signal?: AbortSignal) {
    const { value } = await this.request<{ value: string }>('/screenshot', { signal }, 5000);
    const image = sharp(Buffer.from(value, 'base64'));
    const metadata = await image.metadata();
    const rotated = Boolean(metadata.width && metadata.height && (metadata.width > metadata.height) !== (this.geometry.width > this.geometry.height));
    const geometry = !this.geometry.width || rotated ? await this.size(signal) : this.geometry;
    // All stored regions and node bounds use WDA points. Normalize full captures
    // to that space before existing image checks crop or compare them.
    return image.resize(Math.round(geometry.width), Math.round(geometry.height)).png().toBuffer();
  }
  async source(signal?: AbortSignal) {
    return (await this.request<{ value: string }>('/source?format=xml', { signal }, 30000)).value;
  }
  async activeApp(signal?: AbortSignal) {
    return (await this.request<{ value: { bundleId?: string } }>('/wda/activeAppInfo', { signal })).value.bundleId || '';
  }
  async tap(x: number, y: number, signal?: AbortSignal) {
    this.validatePoint(x, y);
    try { await this.request('/wda/tap', { method: 'POST', body: JSON.stringify({ x, y }), signal }); }
    catch (error) {
      if (!(error instanceof WdaError) || error.status !== 404 || error.code === 'invalid session id') throw error;
      await this.request('/wda/tap/0', { method: 'POST', body: JSON.stringify({ x, y }), signal });
    }
  }
  async swipe(startX: number, startY: number, endX: number, endY: number, duration: number, signal?: AbortSignal) {
    this.validatePoint(startX, startY); this.validatePoint(endX, endY);
    if (!Number.isFinite(duration) || duration < 0 || duration > 60000) throw new RequestBodyError('手势时长无效', 400);
    await this.request('/actions', { method: 'POST', signal, body: JSON.stringify({ actions: [{ type: 'pointer', id: 'finger', parameters: { pointerType: 'touch' }, actions: [
      { type: 'pointerMove', duration: 0, x: Math.round(startX), y: Math.round(startY), origin: 'viewport' },
      { type: 'pointerDown', button: 0 },
      ...(startX === endX && startY === endY ? [{ type: 'pause', duration }] : [{ type: 'pointerMove', duration, x: Math.round(endX), y: Math.round(endY), origin: 'viewport' }]),
      { type: 'pointerUp', button: 0 },
    ] }] }) }, duration + 8000);
  }
  private validatePoint(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || (this.geometry.width && x >= this.geometry.width) || (this.geometry.height && y >= this.geometry.height)) throw new RequestBodyError('iOS 点击坐标超出当前画面', 400);
  }
  async key(keyCode: number, signal?: AbortSignal) {
    const name = ({ 3: 'home', 24: 'volumeUp', 25: 'volumeDown' } as Record<number, string>)[keyCode];
    if (!name) throw new RequestBodyError('iOS 不支持此 Android 按键', 400);
    await this.request('/wda/pressButton', { method: 'POST', body: JSON.stringify({ name }), signal });
  }
  async pinch(centerX: number, centerY: number, direction: 'in' | 'out', percent: number, signal?: AbortSignal) {
    await this.size(signal);
    this.validatePoint(centerX, centerY);
    if (!Number.isFinite(percent) || percent <= 0 || percent >= 1) throw new RequestBodyError('缩放比例需在 0 和 1 之间', 400);
    const radius = Math.min(centerX, this.geometry.width - 1 - centerX, 120);
    if (radius < 2) throw new RequestBodyError('缩放中心过于靠近屏幕边缘', 400);
    const small = Math.max(1, radius * (1 - percent));
    const start = direction === 'out' ? small : radius;
    const end = direction === 'out' ? radius : small;
    await this.request('/actions', { method: 'POST', signal, body: JSON.stringify({ actions: [-1, 1].map((side, index) => ({
      type: 'pointer', id: `finger-${index}`, parameters: { pointerType: 'touch' }, actions: [
        { type: 'pointerMove', duration: 0, origin: 'viewport', x: Math.round(centerX + side * start), y: Math.round(centerY) },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', duration: 800, origin: 'viewport', x: Math.round(centerX + side * end), y: Math.round(centerY) },
        { type: 'pointerUp', button: 0 },
      ],
    })) }) });
  }
  async app(action: 'launch' | 'terminate', bundleId: string, signal?: AbortSignal) {
    if (!/^[\w-]+(?:\.[\w-]+)+$/.test(bundleId)) throw new RequestBodyError('iOS Bundle ID 格式无效', 400);
    await this.request(`/wda/apps/${action}`, { method: 'POST', body: JSON.stringify({ bundleId }), signal });
  }
}

const clients = new Map<string, WdaClient>();
export function iosClient(id: string) {
  const config = iosDevice(id);
  const address = wdaAddressKey(config.wdaBaseUrl);
  let client = clients.get(address);
  if (client && JSON.stringify(client.config) !== JSON.stringify(config)) {
    if (client.active) throw new RequestBodyError('请关闭该设备的预览或脚本执行后再修改 WDA 配置', 409);
    if (client.config.sessionId !== config.sessionId) { client.sessionId = ''; client.owned = false; }
    client.config = config;
  }
  if (!client) { client = new WdaClient(config); clients.set(address, client); }
  return client;
}

export function assertIosConfigurationIdle(next: IosDeviceConfig[]) {
  let effective: IosDeviceConfig[];
  try { effective = iosConnectionCandidates(next); }
  catch { throw new RequestBodyError('iOS 设备配置格式无效', 400); }
  for (const client of clients.values()) {
    if (client.active && JSON.stringify(client.config) !== JSON.stringify(effective.find(device => device.id === client.config.id))) {
      throw new RequestBodyError('请关闭该设备的预览或脚本执行后再修改 WDA 配置', 409);
    }
  }
}

export async function closeIosClients() {
  await Promise.all([...clients.values()].map(client => client.close()));
}

export async function withIosControl<T>(id: string, action: (client: WdaClient) => Promise<T>) {
  const ownerId = `ios-manual:${crypto.randomUUID()}`;
  try { acquireDeviceLock({ deviceId: id, ownerType: 'manual_action', ownerId, ttlMs: 90000 }); }
  catch (error) { if (error instanceof DeviceLockConflictError) throw new RequestBodyError(error.message, 409); throw error; }
  let release: (() => void) | undefined;
  try { const client = iosClient(id); release = await client.retain(); return await action(client); }
  finally { release?.(); releaseDeviceLock(ownerId); }
}
