import type { AndroidDevice, AppPreset } from './types';

export function appPresetsForDevice(apps: AppPreset[], devices: readonly AndroidDevice[], deviceId: string) {
  const device = devices.find(item => item.id === deviceId);
  const platform = device && (device.platform || 'android');
  return apps.filter(app => !platform || !app.platform || app.platform === 'universal' || app.platform === platform);
}
