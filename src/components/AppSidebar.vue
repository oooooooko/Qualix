<script setup lang="ts">
import { DataAnalysis, Grid, Monitor, Operation, InfoFilled, Setting, VideoPlay } from '@element-plus/icons-vue';
import type { MenuKey } from '../types';

defineProps<{ activeMenu: MenuKey; collapsed: boolean }>();
defineEmits<{ select: [key: string] }>();
</script>

<template>
  <aside class="layout-sidebar" aria-label="主导航">
    <div class="layout-sidebar__top">
      <div class="layout-sidebar__logo" aria-hidden="true">Q</div>
      <span v-if="!collapsed" class="layout-sidebar__brand" title="Qualix 移动自动化平台">Qualix</span>
    </div>
    <el-menu :default-active="activeMenu" :default-openeds="['overview', 'laboratory', 'midscene']" :collapse="collapsed"
      :collapse-transition="false" class="layout-menu" @select="$emit('select', $event)">
      <el-menu-item index="appium" aria-label="Appium"><el-icon><Monitor /></el-icon><template #title>Appium</template></el-menu-item>
      <el-sub-menu index="laboratory" aria-label="实验室">
        <template #title>
          <el-icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 3h6M10 3v7L4.6 18.8A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.2L14 10V3M7 15h10" />
            </svg>
          </el-icon>
          <span>实验室</span>
        </template>
        <el-menu-item index="artemis" aria-label="Artemis"><el-icon><Monitor /></el-icon><template #title>Artemis<span class="layout-menu__new">New</span></template></el-menu-item>
        <el-sub-menu index="midscene" aria-label="Midscene">
          <template #title><el-icon><Monitor /></el-icon><span>Midscene</span></template>
          <el-menu-item index="generator" aria-label="测试脚本生成"><el-icon><Operation /></el-icon><template #title>测试脚本生成</template></el-menu-item>
          <el-menu-item index="automation" aria-label="自动化测试"><el-icon><VideoPlay /></el-icon><template #title>自动化测试</template></el-menu-item>
          <el-menu-item index="midscene-config" aria-label="Midscene参数配置"><el-icon><Setting /></el-icon><template #title><span class="layout-menu__label" title="参数配置">参数配置</span></template></el-menu-item>
        </el-sub-menu>
      </el-sub-menu>
      <el-sub-menu index="overview" aria-label="概览">
        <template #title><el-icon><Grid /></el-icon><span>概览</span></template>
        <el-menu-item index="analysis" aria-label="分析页"><el-icon><DataAnalysis /></el-icon><template #title>分析页</template></el-menu-item>
      </el-sub-menu>
      <el-menu-item index="config" aria-label="参数配置"><el-icon><Setting /></el-icon><template #title>参数配置</template></el-menu-item>
      <el-menu-item index="about" aria-label="关于"><el-icon><InfoFilled /></el-icon><template #title>关于</template></el-menu-item>
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
