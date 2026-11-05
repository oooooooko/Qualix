<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight } from '@element-plus/icons-vue';
import type { ModelRound } from '../types';
import { t } from '../../src/i18n';

const props = defineProps<{ rounds: ModelRound[] }>();
const elapsed = computed(() => {
  const seconds = Math.max(0, Math.floor(props.rounds.reduce((total, round) => total + round.durationMs, 0) / 1000));
  return seconds >= 60 ? t('{0}分钟{1}秒', { 0: Math.floor(seconds / 60), 1: seconds % 60 }) : t('{0}秒', { 0: seconds });
});
</script>

<template>
  <details class="model-round-history">
    <summary class="model-round-history__toggle" :title="t('模型调用累计响应耗时')">{{ t('用时 {0}', { 0: elapsed }) }}<el-icon><ArrowRight /></el-icon></summary>
    <div class="model-round-history__content">
      <strong>{{ t('模型调用记录（{0} 轮）', { 0: rounds.length }) }}</strong>
      <details v-for="round in rounds" :key="round.id" class="model-round-history__round">
        <summary>{{ t('第 {0} 轮 · {1}', { 0: round.round, 1: round.source === 'planner' ? t('流程规划') : t('AI 识别') }) }}</summary>
        <pre v-if="round.reasoning">{{ round.reasoning }}</pre>
        <p v-else class="model-round-history__empty">{{ t('本轮模型未返回思考内容') }}</p>
      </details>
    </div>
  </details>
</template>

<style scoped>
.model-round-history { margin-top: 8px; color: var(--el-text-color-regular); font-size: 12px; }
.model-round-history__toggle { display: inline-flex; align-items: center; gap: 6px; padding: 3px 0; list-style: none; color: var(--el-text-color-placeholder); font-size: 13px; }
.model-round-history__toggle::-webkit-details-marker { display: none; }
.model-round-history__toggle:hover { color: var(--el-text-color-regular); }
.model-round-history__toggle :deep(.el-icon) { transition: transform .15s; }
.model-round-history[open] > .model-round-history__toggle :deep(.el-icon) { transform: rotate(90deg); }
.model-round-history__content { margin-top: 8px; border: 1px solid var(--ui-border); border-radius: 8px; padding: 10px; }
.model-round-history summary { cursor: pointer; line-height: 1.7; overflow-wrap: anywhere; }
.model-round-history__round { margin-top: 10px; border-top: 1px solid var(--ui-border); padding-top: 8px; }
.model-round-history__empty { color: var(--el-text-color-secondary); line-height: 1.8; margin: 8px 0; }
.model-round-history pre { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; font: inherit; }
</style>
