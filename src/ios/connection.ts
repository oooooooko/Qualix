import type { IosDeviceConfig } from './types';

export const DEFAULT_IOS_DEVICE: Readonly<IosDeviceConfig> = {
  id: 'ios:default', name: 'iOS',
  wdaBaseUrl: 'http://localhost:8100', mjpegUrl: 'http://localhost:9100',
};

// A manually registered loopback alias represents the same WDA connection.
export function wdaAddressKey(address: string) {
  const url = new URL(address);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.hostname = 'localhost';
  return url.href.replace(/\/+$/, '');
}

export function usesDefaultIosConnection(device: IosDeviceConfig) {
  return wdaAddressKey(device.wdaBaseUrl) === wdaAddressKey(DEFAULT_IOS_DEVICE.wdaBaseUrl)
    && wdaAddressKey(device.mjpegUrl) === wdaAddressKey(DEFAULT_IOS_DEVICE.mjpegUrl)
    && !device.sessionId;
}
