import { onMounted, onScopeDispose, reactive, ref, shallowRef, watch, type Ref } from 'vue';
import * as api from '../api';
import type { AndroidDevice, MenuKey } from '../types';

export function useDevicePreview(activeMenu: Ref<MenuKey>, aiPreviewVisible?: Ref<boolean>) {
  const connectionError = shallowRef('');
  const reconnecting = shallowRef(false);
  const playgroundAvailable = shallowRef(false);
  const playgroundPreviewError = shallowRef('');
  const playgroundDeviceId = shallowRef('');
  const playgroundFrameUrl = shallowRef('');
  const devicePreviewUrl = shallowRef('');
  const androidDevices = ref<AndroidDevice[]>([]);
  const deviceInterfaceSize = reactive({ width: 0, height: 0 });
  async function refreshDevicePreview() {
    devicePreviewUrl.value = playgroundDeviceId.value && (activeMenu.value === 'appium' || activeMenu.value === 'ai-orchestration' && aiPreviewVisible?.value)
      ? `${api.APP_BASE}/api/android-preview?deviceId=${encodeURIComponent(playgroundDeviceId.value)}&t=${Date.now()}` : '';
  }
  async function displaySize() {
    if (!playgroundDeviceId.value) { Object.assign(deviceInterfaceSize, { width: 0, height: 0 }); return; }
    try { Object.assign(deviceInterfaceSize, await api.getAndroidDisplayInfo(playgroundDeviceId.value)); }
    catch { Object.assign(deviceInterfaceSize, { width: 0, height: 0 }); }
  }
  async function reconnect() {
    if (reconnecting.value) return;
    reconnecting.value = true;
    try {
      const payload = await api.getAndroidDevices();
      androidDevices.value = payload.devices || [];
      const id = payload.currentDeviceId || '';
      const changed = id !== playgroundDeviceId.value;
      playgroundDeviceId.value = id;
      playgroundAvailable.value = androidDevices.value.some(device => device.id === id && device.status === 'device');
      connectionError.value = '';
      if (changed || !deviceInterfaceSize.width) await displaySize();
      await refreshDevicePreview();
    } catch (error) { connectionError.value = error instanceof Error ? error.message : '读取设备列表失败'; playgroundAvailable.value = false; }
    finally { reconnecting.value = false; }
  }
  async function switchAndroidDevice(id: string) {
    try { playgroundDeviceId.value = (await api.setAndroidDevice({ deviceId: id })).currentDeviceId || id; await displaySize(); await reconnect(); }
    catch (error) { playgroundPreviewError.value = error instanceof Error ? error.message : '切换设备失败'; }
  }
  async function interact(action: () => Promise<unknown>) {
    try { await action(); playgroundPreviewError.value = ''; await refreshDevicePreview(); }
    catch (error) { playgroundPreviewError.value = error instanceof Error ? error.message : '操作失败'; throw error; }
  }
  const tapDevice = (x: number, y: number) => interact(() => api.tapAndroid({ deviceId: playgroundDeviceId.value, x, y }));
  const swipeDevice = (startX: number, startY: number, endX: number, endY: number, duration = 400) => interact(() => api.swipeAndroid({ deviceId: playgroundDeviceId.value, startX, startY, endX, endY, duration }));
  const triggerDeviceKey = (keyCode: number) => interact(() => api.sendAndroidKeyevent({ deviceId: playgroundDeviceId.value, keyCode }));
  watch([activeMenu, () => aiPreviewVisible?.value], refreshDevicePreview);
  let frames: ReturnType<typeof setInterval>, devices: ReturnType<typeof setInterval>;
  onMounted(() => { void reconnect(); frames = setInterval(refreshDevicePreview, 1000); devices = setInterval(reconnect, 5000); });
  onScopeDispose(() => { clearInterval(frames); clearInterval(devices); });
  return { connectionError, reconnecting, reconnect, playgroundAvailable, playgroundPreviewError, playgroundDeviceId, playgroundFrameUrl, devicePreviewUrl,
    androidDevices, deviceInterfaceSize, refreshDevicePreview, tapDevice, swipeDevice, switchAndroidDevice, triggerDeviceKey };
}
