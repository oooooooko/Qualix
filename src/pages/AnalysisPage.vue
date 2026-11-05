<script setup lang="ts">
import { locale, t } from '../i18n';
import { shallowRef, watch } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { getTestAnalytics } from '../api';
import type { AnalysisResponse } from '../analytics/summary';
import AnalysisCharts from '../components/analytics/AnalysisCharts.vue';
import ReportAnalysis from '../components/analytics/ReportAnalysis.vue';
const props = defineProps<{ active: boolean }>();
const days = shallowRef(0);
const data = shallowRef<AnalysisResponse | null>(null);
const loading = shallowRef(false);
const error = shallowRef('');
let requestId = 0;
async function refresh() {
  const id = ++requestId;
  loading.value = true;
  error.value = '';
  try { const result = await getTestAnalytics(days.value); if (id === requestId) data.value = result; }
  catch (reason) { if (id === requestId) error.value = reason instanceof Error ? reason.message : '统计数据加载失败'; }
  finally { if (id === requestId) loading.value = false; }
}
watch(() => props.active, active => { if (active) void refresh(); }, { immediate: true });
watch(days, () => { void refresh(); });
</script>

<template>
  <div class="analysis-page" :aria-busy="loading">
    <div class="analysis-page__heading">
      <div><h1>{{ t("测试分析") }}</h1><p>{{ t("基于已保存脚本与测试执行记录，查看测试编排的运行情况。") }}</p></div>
      <div class="analysis-page__actions">
        <el-select v-model="days" :aria-label="t('统计时间范围')" style="width: 150px">
          <el-option :label="t('全部时间')" :value="0" /><el-option :label="t('最近 7 天')" :value="7" /><el-option :label="t('最近 30 天')" :value="30" /><el-option :label="t('最近 90 天')" :value="90" />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" @click="refresh">{{ t("刷新统计") }}</el-button>
      </div>
    </div>
    <el-alert v-if="error" type="error" :closable="false" show-icon :title="t(error)"><el-button link type="primary" @click="refresh">{{ t("重新加载") }}</el-button></el-alert>
    <div v-if="loading && !data" class="page-loading" role="status">{{ t("正在汇总测试记录…") }}</div>
    <template v-if="data">
      <div class="analysis-page__note">
        <span>{{ data.days ? t("最近 {0} 天", { 0: data.days }) : t("全部时间") }} {{ t("· 通过率 = 通过 ÷（通过 + 失败）；平均耗时仅统计已完成测试，停止和运行中单独列出。") }}</span>
        <span>{{ t("更新于") }} {{ new Date(data.generatedAt).toLocaleString(locale, { hour12: false }) }}{{ loading ? t("· 更新中…") : '' }}</span>
      </div>
      <AnalysisCharts :data="data" />
      <ReportAnalysis :title="t('测试编排')" :summary="data.appium" />
      <p class="analysis-page__footnote">{{ t("统计来自数据库中的执行记录，不依赖 HTML 报告开关。测试编排按脚本 ID 关联；已删除或无法匹配的记录标记为“历史脚本”。未保存执行记录的测试不计入统计。") }}</p>
    </template>
  </div>
</template>

<style scoped>
.analysis-page { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.analysis-page__heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
h1 { margin: 0; font-size: 22px; font-weight: 600; }
.analysis-page__heading p { margin: 8px 0 0; color: var(--ui-text-secondary); font-size: 13px; }
.analysis-page__actions { display: flex; gap: 12px; }
.analysis-page__note { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--ui-text-secondary); }
.analysis-page__footnote { margin: 0; color: var(--ui-text-secondary); font-size: 12px; line-height: 1.8; }
</style>
