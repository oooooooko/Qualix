<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Close, DataAnalysis, MagicStick, Monitor, InfoFilled, Fold, Expand, Setting } from '@element-plus/icons-vue';
import backIcon from './assets/device-actions/back.svg';
import homeIcon from './assets/device-actions/home.svg';
import powerIcon from './assets/device-actions/power.svg';
import tasksIcon from './assets/device-actions/tasks.svg';
import volumeDownIcon from './assets/device-actions/volume-down.svg';
import volumeUpIcon from './assets/device-actions/volume-up.svg';
import { t } from './i18n';
import * as api from './api';
import type { AppPreset, MenuKey } from './types';
import { useModelConfig } from './config/use-model-config';
import { useDevicePreview } from './composables/use-device-preview';
import AppSidebar from './components/AppSidebar.vue';
const NativeMidscenePage = defineAsyncComponent(() => import('./pages/NativeMidscenePage.vue'));
const AppiumPage = defineAsyncComponent(() => import('./appium-recorder/AppiumPage.vue'));
const AiOrchestrationPage = defineAsyncComponent(() => import('../ai-flow/ui/AiWorkspacePage.vue'));
const AnalysisPage = defineAsyncComponent(() => import('./pages/AnalysisPage.vue'));
const ConfigPage = defineAsyncComponent(() => import('./pages/ConfigPage.vue'));
const HelpCenter = defineAsyncComponent(() => import('./components/help/HelpCenter.vue'));
const menuItems = [
  { key: 'appium', label: '测试编排', icon: Monitor },
  { key: 'ai-orchestration', label: 'AI 编排', icon: MagicStick },
  { key: 'midscene', label: 'Midscene', icon: Monitor },
  { key: 'analysis', label: '分析页', icon: DataAnalysis },
  { key: 'config', label: '参数配置', icon: Setting },
  { key: 'about', label: '关于', icon: InfoFilled },
] as const;
const storedValue = localStorage.getItem('qualix:active-menu') || localStorage.getItem('android-midscene-automation:active-menu');
const stored = ['generator','automation','midscene-config'].includes(storedValue || '') ? 'midscene' : storedValue;
const activeMenu = ref<MenuKey>(menuItems.some(item => item.key === stored) ? stored as MenuKey : 'ai-orchestration');
const visitedMenus = reactive(new Set<MenuKey>([activeMenu.value]));
const openMenus = ref<MenuKey[]>(menuItems.map(item => item.key));
const visibleMenuItems = computed(() => openMenus.value.map(key => menuItems.find(item => item.key === key)!));
const activeMenuLabel = computed(() => menuItems.find(item => item.key === activeMenu.value)!.label);
const sidebarCollapsed = shallowRef(false);
const aiOrchestrationBusy = shallowRef(false);
const aiDevicePreviewVisible = shallowRef(false);
const manualOrchestrationBusy = shallowRef(false);
const midsceneBusy = shallowRef(false);
const appiumScriptsRevision = shallowRef(0);
const requestedAppiumScriptId = shallowRef('');
const appPresets = ref<AppPreset[]>([]);
const appPresetForm = reactive({ id: '', name: '', packageName: '' });
const isSavingAppPreset = shallowRef(false);
const resourceError = shallowRef('');
const { ready: configReady, configForm, appiumAutoSave, isSavingModelConfig, testingModelKey, modelTestStatus, aiRecognitionModelConfigured, loadConfig, saveModelConfig, testModel } = useModelConfig();
const { connectionError, reconnecting, reconnect, playgroundAvailable, playgroundPreviewError, playgroundDeviceId, playgroundFrameUrl, devicePreviewUrl, androidDevices, deviceInterfaceSize, refreshDevicePreview, tapDevice, swipeDevice, switchAndroidDevice, triggerDeviceKey } = useDevicePreview(activeMenu, aiDevicePreviewVisible);
watch(activeMenu, key => { visitedMenus.add(key); if (!openMenus.value.includes(key)) openMenus.value.push(key); localStorage.setItem('qualix:active-menu', key); });
function selectMenu(key: string) { if (menuItems.some(item => item.key === key)) activeMenu.value = key as MenuKey; }
function closeMenu(key: MenuKey) { if (openMenus.value.length < 2) return; const index = openMenus.value.indexOf(key); openMenus.value.splice(index, 1); if (activeMenu.value === key) activeMenu.value = openMenus.value[Math.max(0, index - 1)]; }
function editAiScript(id: string) { requestedAppiumScriptId.value = id; activeMenu.value = 'appium'; }
function resetAppPresetForm() { Object.assign(appPresetForm, { id: '', name: '', packageName: '' }); }
function editAppPreset(app: AppPreset) { Object.assign(appPresetForm, { id: app.id, name: app.name, packageName: app.packageName }); }
async function loadApps() { appPresets.value = (await api.getAppPresets()).apps || []; }
async function saveAppPreset() {
  if (isSavingAppPreset.value) return;
  isSavingAppPreset.value = true;
  try { await api.saveAppPreset({ ...appPresetForm }); await loadApps(); resetAppPresetForm(); ElMessage.success(t('App 已保存')); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : t('保存失败')); }
  finally { isSavingAppPreset.value = false; }
}
async function removeAppPreset(id: string) {
  if (!await ElMessageBox.confirm(t('确定删除该 App 配置吗？'), t('删除 App'), { type: 'warning' }).then(() => true).catch(() => false)) return;
  try { await api.deleteAppPreset({ id }); await loadApps(); if (appPresetForm.id === id) resetAppPresetForm(); }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : t('删除失败')); }
}
async function loadResources() {
  resourceError.value = '';
  const results = await Promise.allSettled([loadConfig(), loadApps()]);
  resourceError.value = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => String(result.reason?.message || result.reason)).join('；');
}
async function reloadSettings() { configReady.value = false; await loadResources(); }
onMounted(loadResources);
const deviceActions = [
  { key: 'power', label: '关机键', icon: powerIcon, keyCode: 26 },
  { key: 'volume-up', label: '音量+', icon: volumeUpIcon, keyCode: 24 },
  { key: 'volume-down', label: '音量-', icon: volumeDownIcon, keyCode: 25 },
  { key: 'back', label: '返回', icon: backIcon, keyCode: 4 },
  { key: 'home', label: '桌面', icon: homeIcon, keyCode: 3 },
  { key: 'tasks', label: '任务', icon: tasksIcon, keyCode: 187 },
] as const;
</script>

<template>
  <div class="layout" :class="{ 'layout--collapsed': sidebarCollapsed }">
    <AppSidebar :active-menu="activeMenu" :collapsed="sidebarCollapsed" @select="selectMenu" />
    <div class="layout-main">
      <header class="layout-header">
        <div class="layout-header__title">
          <el-button text class="layout-collapse" :icon="sidebarCollapsed ? Expand : Fold" :aria-label="sidebarCollapsed ? t('展开导航') : t('收起导航')" :aria-expanded="!sidebarCollapsed" @click="sidebarCollapsed = !sidebarCollapsed" />
          <span class="layout-header__breadcrumb">{{ t('工作空间') }} <span>/</span></span><span>{{ t(activeMenuLabel) }}</span>
        </div>
        <div class="layout-header__actions"><div id="appium-header-actions" v-show="activeMenu === 'appium'"></div></div>
      </header>
      <nav class="layout-page-tabs" :aria-label="t('页面导航')">
        <div v-for="item in visibleMenuItems" :key="item.key" class="layout-page-tab" :class="{ 'is-active': activeMenu === item.key }">
          <button type="button" class="layout-page-tab__select" :aria-current="activeMenu === item.key ? 'page' : undefined" @click="selectMenu(item.key)"><el-icon><component :is="item.icon" /></el-icon>{{ t(item.label) }}</button>
          <button type="button" class="layout-page-tab__close" :aria-label="t('关闭{0}页签', { 0: item.label })" :disabled="openMenus.length === 1" @click="closeMenu(item.key)"><el-icon><Close /></el-icon></button>
        </div>
      </nav>
      <div v-if="connectionError" class="connection-status" role="status"><span>{{ t(connectionError) }}</span><el-button link type="primary" :loading="reconnecting" @click="reconnect">{{ t('重新连接') }}</el-button></div>
      <div v-if="resourceError" class="connection-status" role="alert"><span>{{ resourceError }}</span><el-button link @click="loadResources">{{ t('重试') }}</el-button></div>
      <main class="page-body" :class="{ 'page-body--appium': activeMenu === 'appium' || activeMenu === 'ai-orchestration' || activeMenu === 'midscene', 'page-body--config': activeMenu === 'config' }">
        <AnalysisPage v-if="visitedMenus.has('analysis')" v-show="activeMenu === 'analysis'" :active="activeMenu === 'analysis'" />
        <ConfigPage v-if="visitedMenus.has('config') && configReady" v-show="activeMenu === 'config'" :config-form="configForm" :app-presets="appPresets" :app-preset-form="appPresetForm" :testing-model-key="testingModelKey" :is-saving-model-config="isSavingModelConfig" :is-saving-app-preset="isSavingAppPreset" :model-test-status="modelTestStatus" :appium-save-status="appiumAutoSave.status.value" :appium-save-failed="appiumAutoSave.failed.value"
          @retry-appium-save="appiumAutoSave.retry" @test-model="testModel" @save-model-config="saveModelConfig" @save-app-preset="saveAppPreset" @edit-app-preset="editAppPreset" @delete-app-preset="removeAppPreset" @cancel-app-preset-edit="resetAppPresetForm" />
        <AppiumPage
          v-if="visitedMenus.has('appium')"
          v-show="activeMenu === 'appium'"
          :active="activeMenu === 'appium'"
          :external-busy="aiOrchestrationBusy || midsceneBusy"
          :scripts-revision="appiumScriptsRevision"
          :requested-script-id="requestedAppiumScriptId"
          @busy-change="manualOrchestrationBusy = $event"
          @script-opened="requestedAppiumScriptId = ''"
          :app-presets="appPresets"
          :ai-recognition-model-configured="aiRecognitionModelConfigured"
          :ai-prompt-presets="configForm.appium.aiPromptPresets"
          :report-summary="configForm.appium.reportSummary"
          :flow-background-color="configForm.appium.flowBackgroundColor"
          :flow-node-color="configForm.appium.flowNodeColor"
          :flow-node-border-color="configForm.appium.flowNodeBorderColor"
          :flow-line-color="configForm.appium.flowLineColor"
          :flow-line-style="configForm.appium.flowLineStyle"
          :flow-layout-direction="configForm.appium.flowLayoutDirection"
          :device-actions="deviceActions"
          :playground-available="playgroundAvailable"
          :playground-device-id="playgroundDeviceId"
          :playground-frame-url="activeMenu === 'appium' ? playgroundFrameUrl : ''"
          :playground-preview-error="playgroundPreviewError"
          :device-preview-url="activeMenu === 'appium' ? devicePreviewUrl : ''"
          :android-devices="androidDevices"
          :device-width="deviceInterfaceSize.width"
          :device-height="deviceInterfaceSize.height"
          :switch-android-device="switchAndroidDevice"
          :trigger-device-key="triggerDeviceKey"
          :refresh-device-preview="refreshDevicePreview"
          :swipe-device="swipeDevice"
        />

        <AiOrchestrationPage v-if="visitedMenus.has('ai-orchestration')" v-show="activeMenu === 'ai-orchestration'"
          :system-config="configForm" @settings-saved="reloadSettings" :active="activeMenu === 'ai-orchestration'" :app-presets="appPresets" :model-configured="aiRecognitionModelConfigured"
          :external-busy="manualOrchestrationBusy || midsceneBusy" :appearance="configForm.appium" :device-id="playgroundDeviceId" :available="playgroundAvailable"
          :switch-android-device="switchAndroidDevice" :trigger-device-key="triggerDeviceKey" :refresh-device-preview="refreshDevicePreview" :swipe-device="swipeDevice"
          :devices="androidDevices" :frame-url="playgroundFrameUrl" :image-url="devicePreviewUrl" :preview-error="playgroundPreviewError"
          :device-actions="deviceActions" :device-width="deviceInterfaceSize.width" :device-height="deviceInterfaceSize.height"
          @busy-change="aiOrchestrationBusy = $event" @preview-change="aiDevicePreviewVisible = $event" @saved="appiumScriptsRevision++" @scripts-changed="appiumScriptsRevision++" @edit-script="editAiScript"
          @configure="activeMenu = 'config'" @switch-device="switchAndroidDevice" @trigger-key="triggerDeviceKey" @refresh-preview="refreshDevicePreview"
          @tap="tapDevice($event.x, $event.y)" @swipe="swipeDevice($event.startX, $event.startY, $event.endX, $event.endY, $event.duration)" />

        <NativeMidscenePage v-if="visitedMenus.has('midscene')" v-show="activeMenu==='midscene'" :active="activeMenu==='midscene'" @busy-change="midsceneBusy=$event" />
        <HelpCenter v-if="visitedMenus.has('about')" v-show="activeMenu === 'about'" :active="activeMenu === 'about'" />
      </main>
    </div>
  </div>
</template>
