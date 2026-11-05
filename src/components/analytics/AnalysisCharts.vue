<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { Collection, VideoPlay, CircleCheck, Warning } from '@element-plus/icons-vue';
import type { AnalysisResponse } from '../../analytics/summary';
import { t } from '../../i18n';
const props = defineProps<{ data: AnalysisResponse }>();
const mode = shallowRef<'daily' | 'monthly'>('daily');
const selected = shallowRef<number | null>(null);
const summary = computed(() => props.data.appium);
const cards = computed(() => [
  { name: '测试脚本', value: summary.value.scripts, icon: Collection },
  { name: '执行次数', value: summary.value.runs, icon: VideoPlay },
  { name: '测试通过率', value: summary.value.passRate === null ? '—' : `${(summary.value.passRate * 100).toFixed(1)}%`, icon: CircleCheck },
  { name: '失败次数', value: summary.value.failed, icon: Warning },
]);
const points = computed(() => summary.value[mode.value]);
const maxY = computed(() => Math.max(4, Math.ceil(Math.max(0, ...points.value.map(point => point.runs)) / 4) * 4));
const x = (index: number) => 50 + index * 900 / Math.max(1, points.value.length - 1);
const y = (value: number) => 230 - value / maxY.value * 200;
const line = computed(() => points.value.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.runs)}`).join(' '));
const labels = computed(() => points.value.map((_, index) => index).filter(index => index % Math.max(1, Math.ceil((points.value.length - 1) / 9)) === 0 || index === points.value.length - 1));
const statuses = computed(() => [
  { name: '通过', value: summary.value.passed, color: '#13b8a6' }, { name: '失败', value: summary.value.failed, color: '#ed6a5e' },
  { name: '已停止', value: summary.value.stopped, color: '#e6a23c' }, { name: '运行中', value: summary.value.running, color: '#4ea9ee' },
]);
watch(points, () => { selected.value = null; });
function navigate(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  selected.value = event.key === 'Home' ? 0 : event.key === 'End' ? points.value.length - 1 : Math.max(0, Math.min(points.value.length - 1, (selected.value ?? 0) + (event.key === 'ArrowRight' ? 1 : -1)));
}
</script>
<template>
  <section class="analysis-charts" :aria-label="t('测试统计图表')">
    <div class="analysis-metrics"><article v-for="card in cards" :key="card.name"><el-icon><component :is="card.icon" /></el-icon><div><span>{{ t(card.name) }}</span><strong>{{ card.value }}</strong></div></article></div>
    <div class="analysis-trend">
      <header><h2>{{ t('执行趋势') }}</h2><el-radio-group v-model="mode" size="small"><el-radio-button value="daily">{{ t('按日') }}</el-radio-button><el-radio-button value="monthly">{{ t('按月') }}</el-radio-button></el-radio-group></header>
      <svg viewBox="0 0 1000 275" role="img" :aria-label="t('测试编排执行趋势')" tabindex="0" @keydown="navigate" @mouseleave="selected = null">
        <g v-for="tick in 5" :key="tick"><line x1="50" x2="950" :y1="y((tick - 1) * maxY / 4)" :y2="y((tick - 1) * maxY / 4)" stroke="var(--ui-border)" /><text x="40" :y="y((tick - 1) * maxY / 4) + 4" text-anchor="end">{{ (tick - 1) * maxY / 4 }}</text></g>
        <path :d="line" fill="none" stroke="#13b8a6" stroke-width="3" />
        <g v-for="index in labels" :key="index"><text :x="x(index)" y="255" text-anchor="middle">{{ points[index]?.date }}</text></g>
        <circle v-for="(point, index) in points" :key="point.date" :cx="x(index)" :cy="y(point.runs)" r="7" fill="transparent" @mouseenter="selected = index" />
        <g v-if="selected !== null && points[selected]"><circle :cx="x(selected)" :cy="y(points[selected]!.runs)" r="5" fill="#13b8a6" /><text x="500" y="16" text-anchor="middle">{{ points[selected]!.date }} · {{ t('执行次数') }} {{ points[selected]!.runs }}</text></g>
      </svg>
    </div>
    <div class="analysis-results"><h2>{{ t('执行结果分布') }}</h2><div v-for="status in statuses" :key="status.name" class="analysis-result"><span>{{ t(status.name) }}</span><div><i :style="{ width: `${summary.runs ? status.value / summary.runs * 100 : 0}%`, background: status.color }" /></div><strong>{{ status.value }}</strong></div></div>
  </section>
</template>
<style scoped>
.analysis-charts { display: grid; gap: 20px; }
.analysis-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.analysis-metrics article, .analysis-trend, .analysis-results { border: 1px solid var(--ui-border); border-radius: 12px; background: var(--ui-surface); padding: 20px; }
.analysis-metrics article { display: flex; align-items: center; gap: 16px; }
.analysis-metrics .el-icon { padding: 12px; background: var(--el-color-primary-light-9); color: var(--el-color-primary); border-radius: 12px; font-size: 23px; }
.analysis-metrics span { font-size: 13px; color: var(--ui-text-secondary); }
.analysis-metrics strong { display: block; margin-top: 8px; font-size: 26px; }
header { display: flex; align-items: center; justify-content: space-between; }
h2 { margin: 0 0 16px; font-size: 15px; }
svg { width: 100%; min-height: 190px; }
svg text { fill: var(--ui-text-secondary); font-size: 11px; }
.analysis-result { display: grid; grid-template-columns: 70px 1fr 50px; align-items: center; gap: 12px; margin-top: 14px; font-size: 13px; }
.analysis-result > div { height: 8px; background: var(--ui-bg-soft); border-radius: 5px; overflow: hidden; }
.analysis-result i { display: block; height: 100%; }
@media(max-width: 900px) { .analysis-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
