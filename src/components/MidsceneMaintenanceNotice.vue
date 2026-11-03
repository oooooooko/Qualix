<script setup lang="ts">
import { t } from '../i18n';
</script>

<template>
  <div class="midscene-maintenance">
    <el-alert :title="t('Midscene 维护说明')" type="warning" :closable="false" show-icon> {{ t("本项目中的 Midscene 集成已停止日常维护，现有功能仍保留。后续可能根据情况升级依赖版本，但不再进行深入测试，建议使用 Midscene 官方版本。") }} <a href="https://midscenejs.com/zh/" target="_blank" rel="noopener noreferrer">{{ t("查看官方文档 ↗") }}</a>
    </el-alert>
  </div>
</template>

<style scoped>
.midscene-maintenance { flex: none; padding: 8px 20px 0; }
.midscene-maintenance :deep(.el-alert) { padding: 6px 12px; }
.midscene-maintenance :deep(.el-alert__title) { font-size: 13px; line-height: 19px; }
.midscene-maintenance :deep(.el-alert__description) { margin-top: 2px; font-size: 12px; line-height: 18px; }
.midscene-maintenance :deep(.el-alert__icon) { font-size: 16px; width: 16px; }
.midscene-maintenance a { margin-left: 8px; color: var(--ui-primary); text-decoration: underline; white-space: nowrap; }
</style>
