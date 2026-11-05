<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Hide, View } from '@element-plus/icons-vue';
import { revealModelApiKey } from '../../api';
import { SAVED_API_KEY, type ModelConfigKey } from '../../config/credentials';
import { t } from '../../i18n';

const model = defineModel<string>({ required: true });
const props = defineProps<{ modelKey: ModelConfigKey; baseUrl: string; provider?: string }>();
const visible = shallowRef(false);
const loading = shallowRef(false);
const revealedKey = shallowRef('');
let request: AbortController | undefined;
const displayValue = computed({
  get: () => visible.value && revealedKey.value ? revealedKey.value : model.value,
  set: (value: string) => { revealedKey.value = ''; model.value = value; },
});
function reset() {
  request?.abort();
  loading.value = false;
  revealedKey.value = '';
  visible.value = false;
}
watch(() => [props.modelKey, props.baseUrl, props.provider], reset);
watch(model, () => {
  request?.abort();
  loading.value = false;
  revealedKey.value = '';
  if (model.value === SAVED_API_KEY) visible.value = false;
});
onScopeDispose(reset);
async function toggle() {
  if (visible.value) { reset(); return; }
  if (model.value !== SAVED_API_KEY) { visible.value = true; return; }
  const controller = new AbortController();
  request = controller;
  loading.value = true;
  try {
    const result = await revealModelApiKey(props, controller.signal);
    if (controller.signal.aborted) return;
    revealedKey.value = result.apiKey;
    visible.value = true;
  } catch (error) {
    if (!controller.signal.aborted) ElMessage.error(t(error instanceof Error ? error.message : '无法显示 API Key'));
  } finally {
    if (request === controller) loading.value = false;
  }
}
</script>

<template>
  <el-input v-model="displayValue" :type="visible ? 'text' : 'password'" aria-label="API Key" autocomplete="off" :spellcheck="false"
    :placeholder="t('输入 API Key，点击眼睛可查看已保存的 Key')">
    <template #suffix>
      <el-button class="model-api-key-toggle" text :icon="visible ? Hide : View" :loading="loading" :disabled="!model || loading"
        :aria-label="t(visible ? '隐藏 API Key' : '显示 API Key')" :title="t(visible ? '隐藏 API Key' : '显示 API Key')" @click="toggle" />
    </template>
  </el-input>
</template>

<style scoped>
.model-api-key-toggle { height: 24px; width: 24px; padding: 0; color: var(--el-text-color-secondary); }
</style>
