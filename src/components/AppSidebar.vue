<script setup lang="ts">
import { t } from '../i18n';
import qualixLogo from '../../assets/qualix-logo.png';
import { DataAnalysis, Grid, MagicStick, Monitor, InfoFilled, Setting } from '@element-plus/icons-vue';
import type { MenuKey } from '../types';

defineProps<{ activeMenu: MenuKey; collapsed: boolean }>();
defineEmits<{ select: [key: string] }>();
</script>

<template>
  <aside class="layout-sidebar" :aria-label="t('主导航')">
    <div class="layout-sidebar__top">
      <img class="layout-sidebar__logo" :src="qualixLogo" :alt="collapsed ? 'Qualix' : ''" width="36" height="36" />
      <span v-if="!collapsed" class="layout-sidebar__brand" :title="t('Qualix 移动自动化平台')">Qualix</span>
    </div>
    <el-menu :default-active="activeMenu" :default-openeds="['overview', 'laboratory']" :collapse="collapsed"
      :collapse-transition="false" class="layout-menu" @select="$emit('select', $event)">
      <el-menu-item index="appium" :aria-label="t('测试编排')"><el-icon><Monitor /></el-icon><template #title>{{ t('测试编排') }}</template></el-menu-item>
      <el-menu-item index="ai-orchestration" :aria-label="t('AI 编排')"><el-icon><MagicStick /></el-icon><template #title>{{ t('AI 编排') }}<span class="layout-menu__new">Beta</span></template></el-menu-item>
      <el-sub-menu index="laboratory" :aria-label="t('实验室')"><template #title><el-icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 3h6M10 3v7L4.6 18.8A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.2L14 10V3M7 15h10" /></svg></el-icon><span>{{t('实验室')}}</span></template>
        <el-menu-item index="midscene" aria-label="Midscene"><el-icon><Monitor /></el-icon><template #title>Midscene</template></el-menu-item>
      </el-sub-menu>
      <el-sub-menu index="overview" :aria-label="t('概览')">
        <template #title><el-icon><Grid /></el-icon><span>{{ t("概览") }}</span></template>
        <el-menu-item index="analysis" :aria-label="t('分析页')"><el-icon><DataAnalysis /></el-icon><template #title>{{ t("分析页") }}</template></el-menu-item>
      </el-sub-menu>
      <el-menu-item index="config" :aria-label="t('参数配置')"><el-icon><Setting /></el-icon><template #title>{{ t("参数配置") }}</template></el-menu-item>
      <el-menu-item index="about" :aria-label="t('关于')"><el-icon><InfoFilled /></el-icon><template #title>{{ t("关于") }}</template></el-menu-item>
    </el-menu>
  </aside>
</template>

<style scoped>
.layout-menu__new {
  margin-left: 6px;
  color: var(--el-color-danger);
  font-size: 11px;
  font-weight: 600;
}

.layout-menu__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout-menu :deep(.el-sub-menu .el-sub-menu .el-menu-item) {
  padding-left: 68px !important;
}
</style>
