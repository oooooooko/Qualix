<script setup lang="ts">
import { t } from '../../i18n';
import { Check, Close, Delete, Edit } from '@element-plus/icons-vue';
import type { AppPreset, ConfigForm } from '../../types';
import IosDevicesSettings from './IosDevicesSettings.vue';
import { computed, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue';

const presetFormId = useId();

const props = defineProps<{
  configForm: ConfigForm;
  appPresets: AppPreset[];
  appPresetForm: Pick<AppPreset, 'id' | 'name' | 'packageName' | 'platform'>;
  isSavingModelConfig: boolean;
  isSavingAppPreset: boolean;
}>();

const emit = defineEmits<{
  saveModelConfig: [];
  saveAppPreset: [];
  editAppPreset: [app: AppPreset];
  deleteAppPreset: [id: string];
  cancelAppPresetEdit: [];
}>();

const platformOptions = [
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'universal', label: '通用' },
] as const;
const preservedAddDraft = shallowRef<Pick<AppPreset, 'id' | 'name' | 'packageName' | 'platform'> | null>(null);
const addForm = computed(() => preservedAddDraft.value ?? props.appPresetForm);
const presetList = useTemplateRef<HTMLUListElement>('presetList');
async function startEdit(app: AppPreset) {
  if (props.isSavingAppPreset || props.appPresetForm.id) return;
  preservedAddDraft.value = { ...props.appPresetForm };
  emit('editAppPreset', app);
  await nextTick();
  const row = presetList.value?.querySelector<HTMLElement>('.app-preset-item--editing');
  row?.scrollIntoView({ block: 'nearest' });
  row?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
}
watch(() => props.appPresetForm.id, (id, previousId) => {
  if (!id && previousId && preservedAddDraft.value) {
    Object.assign(props.appPresetForm, preservedAddDraft.value);
    preservedAddDraft.value = null;
  }
});
</script>

<template>
  <div class="config-grid">
    <IosDevicesSettings />
    <el-card shadow="never" class="config-module-card">
      <template #header>
        <div class="panel-header">
          <span>{{ t("运行配置") }}</span>
        </div>
      </template>

      <el-form label-position="top" class="runtime-config-form">
        <el-form-item :label="t('Android SDK 路径')">
          <el-input
            v-model="configForm.runtime.androidSdkPath"
            clearable
            :placeholder="t('留空时读取 ANDROID_SDK_ROOT、ANDROID_HOME 或系统默认路径')"
          />
        </el-form-item>
        <el-form-item :label="t('回放报告目录')">
          <el-input
            v-model="configForm.runtime.reportOutputPath"
            clearable
            :placeholder="t('留空时保存到启动目录下的 output')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="isSavingModelConfig" @click="$emit('saveModelConfig')">{{ t("保存运行配置") }}</el-button>
      </template>
    </el-card>

    <el-card shadow="never" class="config-module-card app-presets-card">
      <template #header>
        <div class="panel-header">
          <span>{{ t("预设 App 参数") }}</span>
        </div>
      </template>

      <div class="app-preset-layout">
        <section class="app-preset-panel app-preset-editor" :aria-label="t('App 预设编辑')">
          <div class="app-preset-panel__heading">
            <h3>{{ t("添加 App") }}</h3>
          </div>
          <p class="app-preset-description">{{ t('保存常用 App，录制时可快速选择。') }}</p>
          <el-form :id="presetFormId" class="app-preset-form" label-position="top" :disabled="isSavingAppPreset || !!appPresetForm.id" @submit.prevent="!appPresetForm.id && $emit('saveAppPreset')">
            <el-form-item class="app-preset-platform" :label="t('平台')">
              <el-select v-model="addForm.platform" :aria-label="t('平台')">
                <el-option v-for="option in platformOptions" :key="option.value" :value="option.value" :label="t(option.label)" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('App 名称')">
              <el-input v-model="addForm.name" :placeholder="t('例如：示例 App')" />
            </el-form-item>
            <el-form-item :label="t('App 包名')">
              <el-input v-model="addForm.packageName" :placeholder="t('例如：com.example.app')" />
            </el-form-item>
            <p class="app-preset-field-help">{{ t('Android 填写包名，iOS 填写 Bundle ID。') }}</p>
          </el-form>
        </section>

        <section class="app-preset-panel app-preset-collection" :aria-label="t('已保存的 App')">
          <div class="app-preset-panel__heading">
            <h3>{{ t("已保存的 App") }}</h3>
            <el-tag size="small" type="info" effect="plain">{{ appPresets.length }} {{ t("个") }}</el-tag>
          </div>
          <ul v-if="appPresets.length" ref="presetList" class="app-preset-items" tabindex="0" :aria-label="t('App 预设列表')">
            <li v-for="app in appPresets" :key="app.id" class="app-preset-item" :class="{ 'app-preset-item--editing': appPresetForm.id === app.id }">
              <el-form v-if="appPresetForm.id === app.id" class="app-preset-inline-editor" :aria-label="t('编辑 {0}', { 0: app.name })" :disabled="isSavingAppPreset" @submit.prevent="$emit('saveAppPreset')">
                <el-select v-model="appPresetForm.platform" :aria-label="t('平台')">
                  <el-option v-for="option in platformOptions" :key="option.value" :value="option.value" :label="t(option.label)" />
                </el-select>
                <el-input v-model="appPresetForm.name" :aria-label="t('App 名称')" :placeholder="t('App 名称')" />
                <el-input v-model="appPresetForm.packageName" :aria-label="t('App 包名')" :placeholder="t('App 包名')" />
                <div class="app-preset-inline-editor__actions">
                  <el-button size="small" :icon="Close" :disabled="isSavingAppPreset" @click="$emit('cancelAppPresetEdit')">{{ t('取消') }}</el-button>
                  <el-button size="small" type="primary" native-type="submit" :icon="Check" :loading="isSavingAppPreset">{{ t('保存') }}</el-button>
                </div>
              </el-form>
              <template v-else>
                <div class="app-preset-item__details"><strong :title="app.name">{{ app.name }}</strong><code :title="app.packageName">{{ app.packageName }}</code></div>
                <el-tag size="small" type="info" effect="plain">{{ t(platformOptions.find(option => option.value === app.platform)?.label || '通用') }}</el-tag>
                <div class="app-preset-item__actions">
                  <el-button text :icon="Edit" :disabled="isSavingAppPreset || !!appPresetForm.id" :aria-label="t('编辑 {0}', { 0: app.name })" :title="t('编辑 {0}', { 0: app.name })" @click="startEdit(app)" />
                  <el-button text :icon="Delete" :disabled="isSavingAppPreset || !!appPresetForm.id" :aria-label="t('删除 {0}', { 0: app.name })" :title="t('删除 {0}', { 0: app.name })" @click="$emit('deleteAppPreset', app.id)" />
                </div>
              </template>
            </li>
          </ul>
          <div v-else class="app-preset-empty">
            {{ t('暂无预设 App') }}
          </div>
        </section>
      </div>
      <template #footer>
        <el-button type="primary" native-type="submit" :form="presetFormId" :loading="isSavingAppPreset && !appPresetForm.id" :disabled="!!appPresetForm.id">{{ t("添加") }}</el-button>
      </template>
    </el-card>
  </div>
</template>

<style scoped>
.runtime-config-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.runtime-config-form :deep(.el-form-item) { margin-bottom: 0; }
@media (max-width: 1000px) { .runtime-config-form { grid-template-columns: minmax(0, 1fr); } }

.app-preset-layout { display: grid; gap: 24px; }
.app-preset-panel { min-width: 0; }
.app-preset-panel h3 { margin: 0; color: var(--ui-text); font-size: 14px; font-weight: 600; }
.app-preset-panel__heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 32px; margin-bottom: 14px; }
.app-preset-description, .app-preset-field-help { margin: 0 0 18px; color: var(--ui-text-secondary); font-size: 12px; line-height: 1.6; }
.app-preset-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.app-preset-form :deep(.el-form-item) { margin-bottom: 0; }
.app-preset-platform { grid-column: 1 / -1; max-width: 240px; }
.app-preset-field-help { grid-column: 1 / -1; margin: -8px 0 0; }
.app-preset-collection { padding-top: 20px; border-top: 1px solid var(--ui-border); }
.app-preset-items { --app-preset-row-height: 72px; max-height: calc(var(--app-preset-row-height) * 3); overflow-y: auto; overscroll-behavior-y: contain; margin: 0; padding: 0; list-style: none; scrollbar-gutter: stable; }
.app-preset-item { display: flex; align-items: center; gap: 12px; height: var(--app-preset-row-height); box-sizing: border-box; min-width: 0; padding: 12px 0; }
.app-preset-item + .app-preset-item { border-top: 1px solid var(--ui-border); }
.app-preset-item--editing { height: auto; min-height: var(--app-preset-row-height); }
.app-preset-item__details { display: grid; flex: 1; gap: 4px; min-width: 0; }
.app-preset-item__details strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-text); font-size: 13px; }
.app-preset-item__details code { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-text-secondary); font-size: 12px; line-height: 1.5; }
.app-preset-item__actions { display: flex; flex-shrink: 0; gap: 4px; }
.app-preset-item__actions :deep(.el-button) { width: 32px; height: 32px; margin: 0; padding: 0; }
.app-preset-inline-editor { display: grid; flex: 1; gap: 10px; min-width: 0; padding-right: 4px; }
.app-preset-inline-editor > .el-select { max-width: 240px; }
.app-preset-inline-editor__actions { display: flex; justify-content: flex-end; gap: 8px; }
.app-preset-inline-editor__actions :deep(.el-button) { margin: 0; }
.app-preset-empty { padding: 28px 0; color: var(--ui-text-secondary); font-size: 13px; text-align: center; }
@media (max-width: 1000px) { .app-preset-form { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) {
  .app-preset-items { --app-preset-row-height: 112px; }
  .app-preset-item { flex-wrap: wrap; gap: 10px; }
  .app-preset-item__details { flex-basis: 100%; }
  .app-preset-item__actions { margin-left: auto; }
}
</style>
