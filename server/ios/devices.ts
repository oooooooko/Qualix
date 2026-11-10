import fs from 'node:fs';
import path from 'node:path';
import { appDataPath } from '../paths';
import type { IosDeviceConfig } from '../../src/ios/types';
import { RequestBodyError } from '../request-body';
import { DEFAULT_IOS_DEVICE, wdaAddressKey } from '../../src/ios/connection';

const file = appDataPath('ios-devices.json');
export const isIosDevice = (id: string) => typeof id === 'string' && id.startsWith('ios:');

export function iosDevices(): IosDeviceConfig[] {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function iosDevice(id: string) {
  const device = iosConnectionCandidates().find(item => item.id === id);
  if (!device) throw new RequestBodyError('iOS 设备未登记，请在参数配置中添加 WDA 连接', 404);
  return device;
}

export function iosConnectionCandidates(configured = iosDevices()): IosDeviceConfig[] {
  if (configured.some(device => device.id === DEFAULT_IOS_DEVICE.id
    || wdaAddressKey(device.wdaBaseUrl) === wdaAddressKey(DEFAULT_IOS_DEVICE.wdaBaseUrl))) return configured;
  return [...configured, { ...DEFAULT_IOS_DEVICE }];
}

export function saveIosDevices(devices: IosDeviceConfig[]) {
  if (!Array.isArray(devices) || devices.length > 20) throw new RequestBodyError('iOS 设备配置格式无效', 400);
  const ids = new Set<string>();
  const addresses = new Set<string>();
  for (const device of devices) {
    if (!device || typeof device.id !== 'string' || typeof device.name !== 'string') throw new RequestBodyError('iOS 设备配置格式无效', 400);
    if (!/^ios:[\w:.-]+$/.test(device.id) || ids.has(device.id)) throw new RequestBodyError('iOS 设备 ID 必须以 ios: 开头且不能重复', 400);
    ids.add(device.id);
    if (!device.name?.trim()) throw new RequestBodyError('请输入 iOS 设备名称', 400);
    for (const value of [device.wdaBaseUrl, device.mjpegUrl]) {
      let url: URL;
      try { url = new URL(value); } catch { throw new RequestBodyError('WDA 和 MJPEG 地址必须是完整的 HTTP 地址', 400); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new RequestBodyError('WDA 地址格式无效', 400);
    }
    const address = wdaAddressKey(device.wdaBaseUrl);
    if (addresses.has(address)) throw new RequestBodyError('同一 WDA 地址只能登记一台设备', 400);
    addresses.add(address);
    if (device.sessionId && !/^[\w-]+$/.test(device.sessionId)) throw new RequestBodyError('WDA session ID 格式无效', 400);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(devices, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file);
}
