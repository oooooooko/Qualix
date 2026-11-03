<script setup lang="ts">
import { t } from '../../i18n';
import { computed, inject, onMounted, shallowRef, useTemplateRef } from 'vue';
import { ElMessage } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import type { AppiumRecordedStep } from '../types';
import { defaultRandomValue, MAX_RANDOM_FILE_BYTES, randomTextCandidates, type RandomValueConfig } from '../random-value';
import { sensitiveVariableName } from '../variables';
import { variablePresetKey, type VariablePresetContext } from '../variable-presets';

const props = defineProps<{ step: AppiumRecordedStep; disabled?: boolean; presets?: VariablePresetContext }>();
const emit = defineEmits<{ update: [Partial<AppiumRecordedStep>] }>();
const config = computed(() => ({ ...defaultRandomValue(), ...props.step.randomValue }));
const fileInput = useTemplateRef<HTMLInputElement>('fileInput');
const importing = shallowRef(false);
const inheritedPresets = inject(variablePresetKey, undefined);
const presets = computed(() => props.presets || inheritedPresets);
const variableOptions = computed(() => presets.value?.options.value || []);
const variablesLoading = computed(() => presets.value?.loading.value || false);
const variablesError = computed(() => presets.value?.error.value || '');
const selectedVariable = computed(() => variableOptions.value.find(variable => variable.name === config.value.name));
const fixedSensitive = computed(() => Boolean(selectedVariable.value?.sensitive || sensitiveVariableName(config.value.name)));
const sensitive = computed(() => Boolean(config.value.sensitive || fixedSensitive.value));
const missingVariable = computed(() => Boolean(config.value.name && !selectedVariable.value && !variablesLoading.value));
const reference = computed(() => `{{${config.value.name || 'NAME'}}}`);
const candidateCount = computed(() => {
  try {
    const candidates = randomTextCandidates(config.value.text);
    return config.value.withoutReplacement ? new Set(candidates).size : candidates.length;
  } catch { return 0; }
});

function update(patch: Partial<RandomValueConfig>) {
  emit('update', { randomValue: { ...config.value, ...patch } });
}

function refreshVariables(visible: boolean) {
  if (visible) void presets.value?.refresh();
}

onMounted(() => { void presets.value?.refresh(); });

async function importText(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || props.disabled) return;
  importing.value = true;
  try {
    if (file.size > MAX_RANDOM_FILE_BYTES) throw new Error('TXT 文件不能超过 1 MB');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    randomTextCandidates(text);
    update({ text, sourceName: file.name });
  } catch (error) {
    ElMessage.error(t(error instanceof TypeError ? t("请导入 UTF-8 编码的 TXT 文件") : error instanceof Error ? error.message : t("TXT 导入失败")));
  } finally { importing.value = false; }
}

</script>

<template>
  <div class="random-value-settings">
    <el-form-item :label="t('结果类型')">
      <el-select :model-value="config.mode" :disabled="disabled" :aria-label="t('随机值类型')" @update:model-value="update({ mode: $event })">
        <el-option :label="t('预设文本 / TXT')" value="text" />
        <el-option :label="t('随机整数')" value="integer" />
        <el-option :label="t('随机 ID（UUID）')" value="uuid" />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('保存到变量')">
      <div class="random-value-settings__field">
        <el-select class="random-value-settings__variable-select" :model-value="config.name || undefined" :disabled="disabled" :loading="variablesLoading" filterable :placeholder="t('选择预设变量 key')" :aria-label="t('随机值变量名')" @visible-change="refreshVariables" @update:model-value="update({ name: String($event), sensitive: variableOptions.find(variable => variable.name === $event)?.sensitive || undefined })">
          <el-option v-if="missingVariable" :label="t('{0}（未预设）', { 0: config.name })" :value="config.name" disabled />
          <el-option v-for="variable in variableOptions" :key="variable.name" :label="variable.name" :value="variable.name">
            <span>{{ variable.name }}</span><small class="random-value-settings__scope">{{ variable.scope === 'private' ? t("私有") : t("全局") }}</small>
          </el-option>
          <template #empty><div class="random-value-settings__empty">{{ t("暂无匹配的预设变量") }}</div></template>
        </el-select>
        <div class="random-value-settings__variable-help">
          <span class="random-value-settings__hint">{{ selectedVariable ? (selectedVariable.scope === 'private' ? t("当前脚本私有变量") : t("使用全局 key，结果保存在当前脚本")) : t("选择已有 key 保存结果") }}</span>
          <el-button link type="primary" :disabled="disabled || !presets" @click="presets?.open()">{{ t("去添加变量") }}</el-button>
        </div>
        <span v-if="variablesError" class="random-value-settings__error" role="alert">{{ t("变量加载失败") }} <el-button link type="primary" :disabled="variablesLoading" @click="presets?.refresh()">{{ t("重试") }}</el-button></span>
        <span v-else-if="missingVariable" class="random-value-settings__error" role="alert">{{ t("此 key 尚未预设，请先添加或重新选择。") }}</span>
      </div>
    </el-form-item>
    <template v-if="config.mode === 'text'">
      <el-form-item :label="t('候选内容')">
        <div class="random-value-settings__field">
          <el-input type="textarea" :rows="4" :model-value="config.text || ''" :disabled="disabled" :placeholder="t('每行一条候选内容')" :aria-label="t('随机候选内容')" @update:model-value="update({ text: String($event), sourceName: undefined })" />
          <div class="random-value-settings__import">
            <input ref="fileInput" type="file" accept=".txt,text/plain" hidden :aria-label="t('导入随机候选 TXT')" :disabled="disabled || importing" @change="importText" />
            <el-button :icon="Upload" :disabled="disabled" :loading="importing" @click="fileInput?.click()">{{ t("导入 TXT") }}</el-button>
            <span class="random-value-settings__count">{{ candidateCount }} {{ t("条") }}{{ config.withoutReplacement ? t("不同") : '' }}{{ t("候选") }}</span>
          </div>
          <span v-if="config.sourceName" class="random-value-settings__hint random-value-settings__file" :title="config.sourceName">{{ config.sourceName }}</span>
          <span class="random-value-settings__hint">{{ t("UTF-8 · 每行一条，忽略空行和 # 注释。内容随脚本保存。") }}</span>
        </div>
      </el-form-item>
      <el-form-item :label="t('抽取方式')">
        <div class="random-value-settings__field">
          <el-select :model-value="config.withoutReplacement === true" :disabled="disabled" :aria-label="t('随机抽取方式')" @update:model-value="update({ withoutReplacement: $event === true })">
            <el-option :label="t('允许重复抽取')" :value="false" />
            <el-option :label="t('本次运行不重复')" :value="true" />
          </el-select>
          <span v-if="config.withoutReplacement" class="random-value-settings__hint">{{ t("候选耗尽时停止，下次回放重新开始。") }}</span>
        </div>
      </el-form-item>
    </template>
    <template v-if="config.mode === 'integer'">
      <el-form-item :label="t('最小值')">
        <el-input-number :model-value="config.min ?? 0" :disabled="disabled" :precision="0" controls-position="right" :aria-label="t('随机整数最小值')" @update:model-value="update({ min: $event ?? 0 })" />
      </el-form-item>
      <el-form-item :label="t('最大值')">
        <el-input-number :model-value="config.max ?? 9999" :disabled="disabled" :precision="0" controls-position="right" :aria-label="t('随机整数最大值')" @update:model-value="update({ max: $event ?? 9999 })" />
      </el-form-item>
      <span class="random-value-settings__hint">{{ t("包含最小值和最大值，结果以文本保存。") }}</span>
    </template>
    <span v-if="config.mode === 'uuid'" class="random-value-settings__hint">{{ t("每次执行生成一个 UUID，并以文本保存。") }}</span>
    <el-form-item :label="t('敏感值')">
      <el-checkbox :model-value="sensitive" :disabled="disabled || fixedSensitive" @update:model-value="update({ sensitive: $event === true })">{{ t("隐藏日志中的结果") }}</el-checkbox>
    </el-form-item>
    <span v-if="sensitive && config.mode === 'text'" class="random-value-settings__hint">{{ t("导出时清空敏感候选内容。") }}</span>
    <span class="random-value-settings__hint">{{ t("后续通过") }} <code>{{ reference }}</code> {{ t("引用结果。") }}</span>
  </div>
</template>

<style scoped>
.random-value-settings { display: flex; flex-direction: column; gap: 12px; min-width: 0; text-align: left; }
.random-value-settings :deep(.el-form-item) { margin-bottom: 0; }
.random-value-settings__field { display: grid; gap: 8px; width: 100%; min-width: 0; }
.random-value-settings__import, .random-value-settings__variable-help { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
.random-value-settings__variable-help .el-button { padding: 0; font-size: 12px; }
.random-value-settings__count { font-size: 12px; color: var(--ui-text-secondary, #64748b); }
.random-value-settings__scope { float: right; margin-left: 16px; color: var(--el-text-color-secondary); }
.random-value-settings__empty { padding: 12px; color: var(--el-text-color-secondary); text-align: center; }
.random-value-settings__file { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.random-value-settings__error { color: var(--el-color-danger); font-size: 12px; line-height: 1.5; }
.random-value-settings__hint { color: var(--ui-text-secondary, #64748b); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
</style>
