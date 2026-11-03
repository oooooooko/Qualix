<script setup lang="ts">
import { locale, t } from '../../i18n';
import { computed, ref, watch } from 'vue';
import type { AnalysisSummary, AnalysisRow } from '../../analytics/summary';
const props = defineProps<{ title: string; summary: AnalysisSummary }>();
const search = ref('');
const page = ref(1);
const sort = ref<{ prop: keyof AnalysisRow; order: string | null }>({ prop: 'lastRunAt', order: 'descending' });
const filteredRows = computed(() => {
  const rows = props.summary.rows.filter(row => row.name.toLowerCase().includes(search.value.trim().toLowerCase()));
  const { prop, order } = sort.value;
  if (order) rows.sort((a, b) => {
    const left = a[prop], right = b[prop];
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    const value = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
    return order === 'ascending' ? value : -value;
  });
  return rows;
});
const rows = computed(() => filteredRows.value.slice((page.value - 1) * 10, page.value * 10));
watch([search, () => props.summary, sort], () => { page.value = 1; });
const rate = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const duration = (value: number | null) => value === null ? '—' : value < 1000 ? `${Math.round(value)} 毫秒` : `${(value / 1000).toFixed(1)} 秒`;
const statusText = { passed: '通过', failed: '失败', stopped: '已停止', running: '运行中' };
const statusType = { passed: 'success', failed: 'danger', stopped: 'info', running: 'warning' } as const;
const date = (value: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(locale.value, { hour12: false }) : '—';
</script>

<template>
  <section class="report-analysis" :aria-label="t('{0} 测试报告分析', { 0: title })">
    <div class="report-analysis__heading">
      <div><h2>{{ title }} {{ t("测试报告") }}</h2><p>{{ t("现有脚本") }} {{ summary.scripts }} {{ t("个 · 其中") }} {{ summary.testedScripts }} {{ t("个在所选范围内有执行记录") }}</p></div>
      <el-input v-model="search" clearable :placeholder="t('搜索脚本名称')" :aria-label="t('搜索 {0} 脚本', { 0: title })" class="report-analysis__search" />
    </div>
    <div class="report-analysis__metrics">
      <div><span>{{ t("执行次数") }}</span><strong>{{ summary.runs }}</strong></div>
      <div><span>{{ t("通过率") }}</span><strong class="metric-primary">{{ rate(summary.passRate) }}</strong></div>
      <div><span>{{ t("通过 / 失败") }}</span><strong><span class="metric-success">{{ summary.passed }}</span> / <span :class="{ 'metric-danger': summary.failed > 0 }">{{ summary.failed }}</span></strong></div>
      <div><span>{{ t("停止 / 运行中") }}</span><strong>{{ summary.stopped }} / {{ summary.running }}</strong></div>
    </div>
    <el-table :data="rows" row-key="id" stripe :default-sort="{ prop: 'lastRunAt', order: 'descending' }"
      :empty-text="search ? t('没有匹配的脚本') : t('暂无脚本或测试记录')" @sort-change="sort = $event">
      <el-table-column prop="name" :label="t('脚本名称')" min-width="200" sortable="custom">
        <template #default="{ row }"><span>{{ row.name }}</span><el-tag v-if="row.archived" size="small" type="info" class="report-analysis__historical">{{ t("历史脚本") }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="runs" :label="t('执行次数')" width="110" sortable="custom" />
      <el-table-column prop="passed" :label="t('通过')" width="85" sortable="custom" />
      <el-table-column prop="failed" :label="t('失败')" width="85" sortable="custom" />
      <el-table-column :label="t('停止 / 运行中')" width="120"><template #default="{ row }">{{ row.stopped }} / {{ row.running }}</template></el-table-column>
      <el-table-column prop="passRate" :label="t('通过率')" width="105" sortable="custom"><template #default="{ row }">{{ rate(row.passRate) }}</template></el-table-column>
      <el-table-column prop="averageDurationMs" :label="t('平均耗时')" width="125" sortable="custom"><template #default="{ row }">{{ duration(row.averageDurationMs) }}</template></el-table-column>
      <el-table-column :label="t('最近状态')" width="105"><template #default="{ row }"><el-tag v-if="row.lastStatus" :type="statusType[row.lastStatus as keyof typeof statusType]" effect="light">{{ t(statusText[row.lastStatus as keyof typeof statusText]) }}</el-tag><span v-else class="report-analysis__muted">{{ t("未执行") }}</span></template></el-table-column>
      <el-table-column prop="lastRunAt" :label="t('最近执行')" min-width="180" sortable="custom"><template #default="{ row }">{{ date(row.lastRunAt) }}</template></el-table-column>
    </el-table>
    <el-pagination v-if="filteredRows.length > 10" v-model:current-page="page" :total="filteredRows.length" :page-size="10" layout="total, prev, pager, next" class="report-analysis__pagination" />
  </section>
</template>

<style scoped>
.report-analysis { padding: 20px; background: var(--ui-surface); border: 1px solid var(--ui-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-card); min-width: 0; }
.report-analysis__heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h2 { margin: 0; font-size: 17px; font-weight: 600; }
p { margin: 8px 0 0; color: var(--ui-text-secondary); font-size: 12px; }
.report-analysis__search { width: 220px; }
.report-analysis__metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; padding: 24px 0; }
.report-analysis__metrics > div { border-right: 1px solid var(--ui-border); padding-left: 16px; }
.report-analysis__metrics > div:first-child { padding-left: 0; }
.report-analysis__metrics > div:last-child { border-right: 0; }
.report-analysis__metrics > div > span { display: block; color: var(--ui-text-secondary); font-size: 13px; margin-bottom: 8px; }
.report-analysis__metrics strong { font-size: 27px; font-weight: 600; font-variant-numeric: tabular-nums; }
.metric-primary { color: var(--ui-primary); }
.metric-success { color: var(--ui-success); }
.metric-danger { color: var(--ui-danger); }
.report-analysis__historical { margin-left: 8px; }
.report-analysis__muted { color: var(--ui-text-muted); }
.report-analysis__pagination { margin-top: 16px; justify-content: flex-end; }
@media (max-width: 800px) { .report-analysis__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .report-analysis__metrics > div { border-right: 0; padding-left: 0; } }
</style>
