<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { ElMessage } from 'element-plus';
import { locale, t } from '../../i18n';
import { APP_BASE, discoverIosDevices, setAndroidDevice } from '../../api';
import type { IosDeviceConfig } from '../../ios/types';
import { DEFAULT_IOS_DEVICE, usesDefaultIosConnection } from '../../ios/connection';
import MarkdownDocument from '../help/MarkdownDocument.vue';
import setupGuide from '../../../IOS_SETUP.md?raw';
import setupGuideEn from '../../../IOS_SETUP.en.md?raw';
import { Connection, Delete, Document } from '@element-plus/icons-vue';

const devices = ref<IosDeviceConfig[]>([]);
const saving = shallowRef(false);
const error = shallowRef('');
const configurationError = shallowRef('');
const configurationLoaded = shallowRef(false);
const discovery = shallowRef<Awaited<ReturnType<typeof discoverIosDevices>> | null>(null);
const detecting = shallowRef(false);
const connecting = shallowRef(false);
const expanded = ref<string[]>([]);
const defaultDevice = computed(() => discovery.value?.devices?.find(device => device.id === discovery.value?.defaultDeviceId && device.status === 'device'));
async function detect() {
  detecting.value = true;
  try { discovery.value = await discoverIosDevices(); error.value = ''; }
  catch (cause) { discovery.value = null; error.value = cause instanceof Error ? cause.message : '检测 iOS 设备失败'; }
  finally { detecting.value = false; }
}
async function loadConfiguration() {
  try {
    const response = await fetch(`${APP_BASE}/api/ios/devices`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    devices.value = data.devices || [];
    if (devices.value.length > 1 || devices.value.some(device => !usesDefaultIosConnection(device))) expanded.value = ['advanced'];
    configurationLoaded.value = true;
  } catch (cause) { configurationError.value = cause instanceof Error ? cause.message : '读取 iOS 配置失败'; }
}
onMounted(() => { void detect(); void loadConfiguration(); });
async function connect() {
  if (connecting.value) return;
  connecting.value = true;
  try {
    await detect();
    if (!defaultDevice.value) throw new Error('未检测到默认 WDA，请按下方说明启动后重试');
    await setAndroidDevice({ deviceId: defaultDevice.value.id });
    window.dispatchEvent(new Event('qualix:devices-changed'));
    ElMessage.success(t('已连接 iOS 设备，可返回测试编排开始录制'));
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'iOS 连接失败'; }
  finally { connecting.value = false; }
}
function add() {
  devices.value = [...devices.value, { ...DEFAULT_IOS_DEVICE, id: `ios:${crypto.randomUUID()}`, name: 'iPhone', sessionId: '' }];
}
async function save() {
  saving.value = true;
  try {
    const response = await fetch(`${APP_BASE}/api/ios/devices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ devices: devices.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    error.value = ''; ElMessage.success(t('iOS 连接配置已保存'));
    window.dispatchEvent(new Event('qualix:devices-changed'));
    await detect();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存 iOS 配置失败'; }
  finally { saving.value = false; }
}
</script>

<template>
  <el-card shadow="never" class="config-module-card ios-settings">
    <template #header>
      <div class="panel-header">
        <span>{{ t('iOS 设备连接') }}</span>
        <el-tag :type="defaultDevice ? 'success' : 'info'">{{ t(detecting ? '正在检测 iOS 设备' : defaultDevice ? '已发现默认 iOS 设备' : '未发现默认 WDA') }}</el-tag>
      </div>
    </template>
    <el-alert v-if="error" :title="t(error)" type="error" :closable="false" />
    <el-alert v-if="configurationError" :title="t(configurationError)" type="error" :closable="false" />
    <el-collapse v-model="expanded" class="ios-connection-options">
      <el-collapse-item :title="t('连接准备与排查')" name="setup">
        <template #title>
          <span class="ios-option-heading">
          <span class="ios-option-icon" aria-hidden="true"><el-icon><Document /></el-icon></span>
          <span class="ios-option-label"><strong>{{ t('连接准备与排查') }}</strong><small aria-hidden="true">{{ t('首次连接、端口转发与常见问题。') }}</small></span>
          </span>
        </template>
        <MarkdownDocument :content="locale === 'en' ? setupGuideEn : setupGuide" />
      </el-collapse-item>
      <el-collapse-item :title="t('多设备 / 自定义连接')" name="advanced">
        <template #title>
          <span class="ios-option-heading">
          <span class="ios-option-icon" aria-hidden="true"><el-icon><Connection /></el-icon></span>
          <span class="ios-option-label"><strong>{{ t('多设备 / 自定义连接') }}</strong><small aria-hidden="true">{{ t('管理多台设备或修改连接地址。') }}</small></span>
          </span>
        </template>
        <p class="ios-advanced-help">{{ t('多台设备请使用不同的本机端口；保存后在预览设备列表中选择。') }}</p>
        <div v-if="!devices.length" class="ios-devices-empty">{{ t('尚未添加自定义设备') }}</div>
        <section v-for="(device, index) in devices" :key="index" class="ios-device-entry">
          <div class="ios-device-entry__header">
            <div class="ios-device-entry__name"><span class="ios-device-index">{{ index + 1 }}</span><strong>{{ device.name || t('iOS 设备') }}</strong></div>
            <el-button type="danger" text size="small" :icon="Delete" @click="devices = devices.filter(item => item !== device)">{{ t('移除设备') }}</el-button>
          </div>
          <el-form label-position="top" class="ios-device-form">
            <el-form-item :label="t('设备名称')"><el-input v-model="device.name" /></el-form-item>
            <el-form-item :label="t('设备 ID')"><el-input v-model="device.id" placeholder="ios:device-udid" /></el-form-item>
            <el-form-item :label="t('WDA 控制地址')"><el-input v-model="device.wdaBaseUrl" :placeholder="DEFAULT_IOS_DEVICE.wdaBaseUrl" /></el-form-item>
            <el-form-item :label="t('MJPEG 地址')"><el-input v-model="device.mjpegUrl" :placeholder="DEFAULT_IOS_DEVICE.mjpegUrl" /></el-form-item>
            <el-form-item class="ios-device-session" :label="t('已有 WDA session ID（可选）')"><el-input v-model="device.sessionId" /></el-form-item>
          </el-form>
        </section>
      </el-collapse-item>
    </el-collapse>
    <template #footer>
      <el-button type="primary" :loading="detecting" :disabled="connecting" @click="detect">{{ t('重新检测') }}</el-button>
      <el-button type="primary" :loading="connecting" :disabled="detecting" @click="connect">{{ t('连接默认设备') }}</el-button>
      <template v-if="expanded.includes('advanced')">
        <el-button type="primary" @click="add">{{ t('添加 iOS 设备') }}</el-button>
        <el-button type="primary" :loading="saving" :disabled="!configurationLoaded" @click="save">{{ t('保存 iOS 配置') }}</el-button>
      </template>
    </template>
  </el-card>
</template>

<style scoped>
.ios-settings p { color: var(--el-text-color-secondary); line-height: 1.6; }
.ios-settings > :deep(.el-card__body > .el-alert) { margin-bottom: 16px; }
.ios-connection-options { display: grid; gap: 12px; border: 0; --el-collapse-header-bg-color: var(--ui-surface); --el-collapse-content-bg-color: var(--ui-surface); }
.ios-connection-options :deep(.el-collapse-item) { min-width: 0; overflow: hidden; border: 1px solid var(--ui-border); border-radius: 10px; }
.ios-connection-options :deep(.el-collapse-item__header) { height: auto; min-height: 76px; padding: 14px 18px; box-sizing: border-box; border: 0; gap: 12px; line-height: 1.5; transition: background-color 0.15s; }
.ios-connection-options :deep(.el-collapse-item__header:hover), .ios-connection-options :deep(.el-collapse-item__header.is-active) { background: var(--ui-bg-soft); }
.ios-connection-options :deep(.el-collapse-item__header:focus-visible) { outline: 2px solid var(--ui-primary); outline-offset: -3px; }
.ios-connection-options :deep(.el-collapse-item__arrow) { margin: 0 0 0 auto; color: var(--ui-text-secondary); }
.ios-connection-options :deep(.el-collapse-item__wrap) { border: 0; }
.ios-connection-options :deep(.el-collapse-item__content) { padding: 18px; border-top: 1px solid var(--ui-border); }
.ios-option-heading { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ios-option-icon { display: grid; flex: 0 0 36px; width: 36px; height: 36px; place-items: center; border-radius: 9px; background: var(--el-color-primary-light-9); color: var(--ui-primary); font-size: 18px; }
.ios-option-label { display: grid; gap: 3px; min-width: 0; text-align: left; }
.ios-option-label strong { color: var(--ui-text); font-size: 14px; font-weight: 600; }
.ios-option-label small { color: var(--ui-text-secondary); font-size: 12px; font-weight: 400; }
.ios-advanced-help { margin: 0 0 16px; font-size: 12px; }
.ios-devices-empty { padding: 28px 16px; border: 1px dashed var(--ui-border); border-radius: 8px; color: var(--ui-text-secondary); text-align: center; font-size: 13px; }
.ios-device-entry { padding: 16px; border: 1px solid var(--ui-border); border-radius: 10px; background: var(--ui-bg-soft); }
.ios-device-entry + .ios-device-entry { margin-top: 12px; }
.ios-device-entry__header, .ios-device-entry__name { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ios-device-entry__header { justify-content: space-between; margin-bottom: 16px; }
.ios-device-entry__name strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-text); font-size: 13px; }
.ios-device-entry__header > .el-button { flex-shrink: 0; }
.ios-device-index { display: grid; flex: 0 0 24px; width: 24px; height: 24px; place-items: center; border-radius: 6px; background: var(--ui-surface); color: var(--ui-primary); font-size: 12px; font-weight: 600; }
.ios-device-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ios-device-form :deep(.el-form-item) { margin-bottom: 0; }
.ios-device-session { grid-column: 1 / -1; }
.ios-connection-options :deep(.markdown-document__h1) { display: none; }
.ios-connection-options :deep(.markdown-document__h2:first-of-type) { margin-top: 0; }
@media (max-width: 800px) { .ios-device-form { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) {
  .ios-connection-options :deep(.el-collapse-item__header), .ios-connection-options :deep(.el-collapse-item__content) { padding: 12px; }
  .ios-device-entry { padding: 12px; }
}
</style>
