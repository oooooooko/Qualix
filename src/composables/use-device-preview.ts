import { computed, onMounted, onScopeDispose, reactive, ref, shallowRef, watch, type Ref } from 'vue';
import * as api from '../api';
import type { AndroidDevice, MenuKey } from '../types';
import type { IosPreview } from '../ios/types';

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
  const iosPreview = shallowRef<IosPreview | null>(null);
  const isIos = computed(() => androidDevices.value.find(device => device.id === playgroundDeviceId.value)?.platform === 'ios');
  let epoch = 0;
  let previewConnecting = false;
  let statusLoading = false;
  let statusFailures = 0;
  let inventoryFailures = 0;
  let disposed = false;
  const visible = () => !disposed && !document.hidden && (activeMenu.value === 'appium' || activeMenu.value === 'ai-orchestration' && aiPreviewVisible?.value);
  function releaseIos() {
    const previous = iosPreview.value;
    iosPreview.value = null;
    statusFailures = 0;
    if (previous) void api.closeIosPreview(previous.previewSessionId).catch(() => {});
  }
  async function connectIos() {
    if (previewConnecting || iosPreview.value || !visible()) return;
    previewConnecting = true;
    const generation = epoch, deviceId = playgroundDeviceId.value;
    try {
      const preview = await api.createIosPreview(deviceId);
      if (generation !== epoch || !visible() || deviceId !== playgroundDeviceId.value) { void api.closeIosPreview(preview.previewSessionId); return; }
      iosPreview.value = preview;
      Object.assign(deviceInterfaceSize, preview.geometry);
      devicePreviewUrl.value = `${api.APP_BASE}${preview.streamUrl}?mode=${preview.mode}&connect=${Date.now()}`;
      playgroundPreviewError.value = '';
    } catch (error) {
      if (generation === epoch) playgroundPreviewError.value = error instanceof Error ? error.message : 'iOS 预览连接失败';
    } finally { previewConnecting = false; }
  }
  async function refreshDevicePreview(force = false) {
    if (!visible()) { releaseIos(); devicePreviewUrl.value = ''; return; }
    if (isIos.value) {
      if (!iosPreview.value) await connectIos();
      else if (force === true) devicePreviewUrl.value = `${api.APP_BASE}${iosPreview.value.streamUrl}?mode=${iosPreview.value.mode}&connect=${Date.now()}`;
      return;
    }
    releaseIos();
    devicePreviewUrl.value = playgroundDeviceId.value && (activeMenu.value === 'appium' || activeMenu.value === 'ai-orchestration' && aiPreviewVisible?.value)
      ? `${api.APP_BASE}/api/android-preview?deviceId=${encodeURIComponent(playgroundDeviceId.value)}&t=${Date.now()}` : '';
  }
  async function displaySize() {
    if (!playgroundDeviceId.value) { Object.assign(deviceInterfaceSize, { width: 0, height: 0 }); return; }
    const deviceId = playgroundDeviceId.value;
    try { const size = await api.getAndroidDisplayInfo(deviceId); if (deviceId === playgroundDeviceId.value) Object.assign(deviceInterfaceSize, size); }
    catch { if (deviceId === playgroundDeviceId.value && !isIos.value) Object.assign(deviceInterfaceSize, { width: 0, height: 0 }); }
  }
  async function reconnect() {
    if (reconnecting.value) return;
    reconnecting.value = true;
    const generation = epoch;
    try {
      const payload = await api.getAndroidDevices();
      if (generation !== epoch || disposed) return;
      inventoryFailures = 0;
      androidDevices.value = payload.devices || [];
      const id = payload.currentDeviceId || '';
      const changed = id !== playgroundDeviceId.value;
      if (changed) { epoch++; releaseIos(); devicePreviewUrl.value = ''; }
      playgroundDeviceId.value = id;
      playgroundAvailable.value = androidDevices.value.some(device => device.id === id && device.status === 'device');
      connectionError.value = '';
      if (changed || !deviceInterfaceSize.width) await displaySize();
      await refreshDevicePreview();
    } catch (error) {
      connectionError.value = error instanceof Error ? error.message : '读取设备列表失败';
      if (!isIos.value || ++inventoryFailures >= 3) playgroundAvailable.value = false;
    }
    finally { reconnecting.value = false; }
  }
  async function switchAndroidDevice(id: string) {
    const generation = ++epoch;
    releaseIos(); devicePreviewUrl.value = '';
    try {
      const payload = await api.setAndroidDevice({ deviceId: id });
      if (generation !== epoch || disposed) return;
      playgroundDeviceId.value = payload.currentDeviceId || id;
      await displaySize(); await refreshDevicePreview();
      playgroundAvailable.value = androidDevices.value.some(device => device.id === playgroundDeviceId.value && device.status === 'device');
    }
    catch (error) { if (generation === epoch) playgroundPreviewError.value = error instanceof Error ? error.message : '切换设备失败'; }
  }
  async function interact(action: () => Promise<unknown>) {
    try { await action(); playgroundPreviewError.value = ''; await refreshDevicePreview(); }
    catch (error) { playgroundPreviewError.value = error instanceof Error ? error.message : '操作失败'; throw error; }
  }
  const iosInput = () => ({ deviceId: playgroundDeviceId.value, geometryRevision: iosPreview.value?.geometry.revision });
  const tapDevice = (x: number, y: number) => interact(() => isIos.value ? api.controlIos('tap', { ...iosInput(), x, y }) : api.tapAndroid({ deviceId: playgroundDeviceId.value, x, y }));
  const swipeDevice = (startX: number, startY: number, endX: number, endY: number, duration = 400) => interact(() => isIos.value ? api.controlIos('swipe', { ...iosInput(), startX, startY, endX, endY, duration }) : api.swipeAndroid({ deviceId: playgroundDeviceId.value, startX, startY, endX, endY, duration }));
  const triggerDeviceKey = (keyCode: number) => interact(() => isIos.value ? api.controlIos('key', { ...iosInput(), keyCode }) : api.sendAndroidKeyevent({ deviceId: playgroundDeviceId.value, keyCode }));
  async function pollIosStatus() {
    const current = iosPreview.value;
    if (!current || statusLoading || !visible()) return;
    statusLoading = true;
    try {
      const next = await api.getIosPreviewStatus(current.previewSessionId);
      if (iosPreview.value?.previewSessionId !== current.previewSessionId) return;
      statusFailures = 0;
      iosPreview.value = next;
      Object.assign(deviceInterfaceSize, next.geometry);
      playgroundPreviewError.value = next.status === 'unavailable' ? next.error : '';
      if (next.status === 'reconnecting' && current.status !== 'reconnecting' || next.mode !== current.mode) devicePreviewUrl.value = `${api.APP_BASE}${next.streamUrl}?mode=${next.mode}&connect=${Date.now()}`;
    } catch (error) {
      if (iosPreview.value?.previewSessionId === current.previewSessionId) {
        if ((error as { status?: number }).status === 404) {
          releaseIos(); devicePreviewUrl.value = '';
        } else if (++statusFailures < 3) return;
        playgroundPreviewError.value = error instanceof Error ? error.message : 'iOS 预览暂不可用';
      }
    } finally { statusLoading = false; }
  }
  watch([activeMenu, () => aiPreviewVisible?.value], () => { void refreshDevicePreview(); });
  let frames: ReturnType<typeof setInterval>, devices: ReturnType<typeof setInterval>, status: ReturnType<typeof setInterval>;
  const visibilityChange = () => { epoch++; void refreshDevicePreview(); };
  onMounted(() => { void reconnect(); frames = setInterval(refreshDevicePreview, 1000); devices = setInterval(reconnect, 5000); status = setInterval(pollIosStatus, 3000); document.addEventListener('visibilitychange', visibilityChange); window.addEventListener('qualix:devices-changed', reconnect); });
  onScopeDispose(() => { disposed = true; epoch++; releaseIos(); clearInterval(frames); clearInterval(devices); clearInterval(status); document.removeEventListener('visibilitychange', visibilityChange); window.removeEventListener('qualix:devices-changed', reconnect); });
  return { connectionError, reconnecting, reconnect, playgroundAvailable, playgroundPreviewError, playgroundDeviceId, playgroundFrameUrl, devicePreviewUrl,
    androidDevices, deviceInterfaceSize, refreshDevicePreview: () => refreshDevicePreview(true), tapDevice, swipeDevice, switchAndroidDevice, triggerDeviceKey };
}
