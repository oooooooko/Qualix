<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getAppiumLlmPrompt } from '../api';
import type { AppiumScriptDraft } from '../types';

const props = defineProps<{ draft: AppiumScriptDraft }>();
const busy = ref(false);

async function copyPrompt() {
  if (busy.value) return;
  busy.value = true;
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('当前浏览器无法访问剪贴板，请使用 localhost 或 HTTPS 并允许剪贴板权限');
    }
    const { prompt } = await getAppiumLlmPrompt(props.draft);
    await navigator.clipboard.writeText(prompt);
    ElMessage.success('已复制流程、节点说明及连接规则，可粘贴给 LLM 使用');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '获取流程内容失败，请重试');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="llm-prompt-actions" :aria-busy="busy">
    <button type="button" class="llm-prompt-actions__link" :disabled="busy" @click="copyPrompt">复制给 LLM</button>
  </div>
</template>

<style scoped>
.llm-prompt-actions { display: inline-flex; align-items: center; white-space: nowrap; }
.llm-prompt-actions__link { padding: 0; border: 0; background: none; box-shadow: none; color: #566b95; font-size: 14px; font-weight: 500; line-height: 24px; cursor: pointer; }
.llm-prompt-actions__link:hover:not(:disabled) { color: #42577f; }
.llm-prompt-actions__link:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 3px; }
.llm-prompt-actions__link:disabled { cursor: not-allowed; }
</style>
