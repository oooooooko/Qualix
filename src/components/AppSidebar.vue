<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue';
import { t } from '../i18n';
import qualixLogo from '../../assets/qualix-logo.png';
import { DArrowLeft, DArrowRight, DataAnalysis, Grid, MagicStick, Monitor, InfoFilled, Setting } from '@element-plus/icons-vue';
import type { MenuKey, SidebarMode } from '../types';

defineProps<{ activeMenu: MenuKey; hasUnreadChangelog?: boolean }>();
defineEmits<{ select: [key: string] }>();

const mode = defineModel<SidebarMode>('mode', { required: true });
const hovering = shallowRef(false);
const collapsed = computed(() => mode.value === 'collapsed' || (mode.value === 'hover' && !hovering.value));
const collapseButton = useTemplateRef<HTMLButtonElement>('collapseButton');
const pinButton = useTemplateRef<HTMLButtonElement>('pinButton');

watch(collapsed, value => {
  if (value && document.activeElement === pinButton.value) collapseButton.value?.focus();
});
</script>

<template>
  <aside
    id="app-sidebar"
    class="layout-sidebar"
    :class="{ 'layout-sidebar--collapsed': collapsed }"
    :aria-label="t('主导航')"
    @pointerenter="hovering = $event.pointerType === 'mouse'"
    @pointerleave="hovering = false"
  >
    <div class="layout-sidebar__top">
      <img class="layout-sidebar__logo" :src="qualixLogo" :alt="collapsed ? 'Qualix' : ''" width="36" height="36" />
      <span v-if="!collapsed" class="layout-sidebar__brand" :title="t('Qualix 移动自动化平台')">Qualix</span>
    </div>
    <el-menu id="app-sidebar-menu" :default-active="activeMenu" :default-openeds="['overview', 'laboratory']" :collapse="collapsed"
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
      <el-menu-item index="about" :aria-label="t('关于')"><el-icon><InfoFilled /><span v-if="collapsed && hasUnreadChangelog" class="unread-update-label layout-menu__update-label--collapsed" role="img" :aria-label="t('有新的更新说明')">new</span></el-icon><template #title>{{ t("关于") }}<span v-if="!collapsed && hasUnreadChangelog" class="unread-update-label layout-menu__update-label" role="img" :aria-label="t('有新的更新说明')">new</span></template></el-menu-item>
    </el-menu>
    <div class="layout-sidebar__controls">
      <button
        ref="collapseButton"
        type="button"
        :aria-label="t(collapsed ? '展开导航' : '收起导航')"
        :title="t(collapsed ? '展开导航' : '收起导航')"
        :aria-expanded="!collapsed"
        aria-controls="app-sidebar-menu"
        @click="mode = collapsed ? 'expanded' : 'collapsed'"
      >
        <component :is="collapsed ? DArrowRight : DArrowLeft" aria-hidden="true" />
      </button>
      <button
        v-if="!collapsed"
        ref="pinButton"
        type="button"
        :aria-label="t('固定侧栏')"
        :title="t(mode === 'expanded' ? '取消固定侧栏' : '固定侧栏')"
        :aria-pressed="mode === 'expanded'"
        @click="mode = mode === 'expanded' ? 'hover' : 'expanded'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-if="mode === 'expanded'" d="M16 9V4l1-1V2H7v1l1 1v5a4 4 0 0 1-4 4v2h16v-2a4 4 0 0 1-4-4ZM12 15v7" />
          <path v-else d="m2 2 20 20M12 15v7M9 2h8v1l-1 1v5a4 4 0 0 0 4 4v2M8 9a4 4 0 0 1-4 4v2h11" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.layout-menu__update-label { margin-left: 6px; }
.layout-menu__update-label--collapsed { position: absolute; top: -7px; right: -13px; font-size: 9px; }
.layout-sidebar__controls {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.layout-sidebar__controls button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: var(--ui-bg-soft);
  color: var(--ui-text-secondary);
  cursor: pointer;
}

.layout-sidebar__controls button:hover {
  background: var(--el-color-primary-light-9);
  color: var(--ui-text);
}

.layout-sidebar__controls svg { width: 16px; height: 16px; }

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
