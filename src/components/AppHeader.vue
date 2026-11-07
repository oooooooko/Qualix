<script setup lang="ts">
import { Expand, Fold, Moon, Sunny } from '@element-plus/icons-vue';
import { t } from '../i18n';
import { darkMode, toggleDarkMode } from '../theme';
import LanguageSwitcher from './LanguageSwitcher.vue';

defineProps<{ pageLabel: string; sidebarCollapsed: boolean; showAppiumActions: boolean }>();
defineEmits<{ toggleSidebar: [] }>();
</script>

<template>
  <header class="layout-header" :class="{ 'layout-header--appium': showAppiumActions }">
    <div class="layout-header__title">
      <el-button
        text circle
        class="layout-header__icon"
        :icon="sidebarCollapsed ? Expand : Fold"
        :aria-label="t(sidebarCollapsed ? '展开导航' : '收起导航')"
        :title="t(sidebarCollapsed ? '展开导航' : '收起导航')"
        :aria-expanded="!sidebarCollapsed"
        aria-controls="app-sidebar"
        @click="$emit('toggleSidebar')"
      />
      <span class="layout-header__breadcrumb" aria-hidden="true">{{ t('工作空间') }} <span>/</span></span>
      <span class="layout-header__page" :title="pageLabel">{{ pageLabel }}</span>
    </div>
    <div id="appium-header-actions" v-show="showAppiumActions" class="layout-header__appium"></div>
    <div class="layout-header__preferences">
      <LanguageSwitcher />
      <div class="layout-header__appearance">
        <button
          type="button"
          role="switch"
          class="theme-switch"
          :aria-label="t('暗黑模式')"
          :aria-checked="darkMode"
          :title="t(darkMode ? '切换到浅色模式' : '切换到深色模式')"
          @click="toggleDarkMode"
        >
          <span class="theme-switch__track" aria-hidden="true">
            <span class="theme-switch__thumb"><component :is="darkMode ? Moon : Sunny" /></span>
          </span>
        </button>
      </div>
      <slot name="preferences" />
      <a
        class="layout-header__github"
        href="https://github.com/oooooooko/Qualix"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Qualix on GitHub"
        title="GitHub"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.547-1.387-1.336-1.755-1.336-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.51 11.51 0 0 1 12 6.899c1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      </a>
    </div>
  </header>
</template>

<style scoped>
.layout-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 16px;
  flex: none;
  min-height: 56px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--ui-border);
  background: light-dark(var(--ui-surface), var(--ui-bg));
}

.layout-header--appium {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.layout-header__title,
.layout-header__preferences {
  display: flex;
  align-items: center;
  gap: 8px;
}

.layout-header__title {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
}

.layout-header__breadcrumb {
  display: flex;
  gap: 8px;
  color: var(--ui-text-secondary);
  font-weight: 400;
  white-space: nowrap;
}

.layout-header__breadcrumb > span { color: var(--ui-border-strong); }
.layout-header__page { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.layout-header__icon.el-button { flex: none; width: 34px; height: 34px; padding: 0; font-size: 18px; }

.layout-header__preferences {
  justify-self: end;
  gap: 0;
}

.layout-header__appearance {
  display: flex;
  align-items: center;
  height: 24px;
  padding-inline: 12px;
  border-inline: 1px solid var(--ui-border);
}

.theme-switch,
.layout-header__github {
  display: grid;
  place-items: center;
  height: 36px;
  color: var(--ui-text-secondary);
}

.theme-switch {
  padding: 0;
  border: 0;
  border-radius: 18px;
  background: none;
  cursor: pointer;
}

.theme-switch__track {
  display: flex;
  align-items: center;
  width: 40px;
  height: 22px;
  padding: 1px;
  border: 1px solid var(--ui-border-strong);
  border-radius: 11px;
  background: light-dark(#8e96aa24, #65758529);
  transition: border-color 160ms ease;
}

.theme-switch:hover .theme-switch__track { border-color: var(--ui-text-secondary); }

.theme-switch__thumb {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: light-dark(#fff, #000);
  box-shadow: 0 1px 2px rgb(0 0 0 / 10%);
  transition: transform 220ms ease;
}

.theme-switch__thumb svg { width: 12px; height: 12px; }
.theme-switch[aria-checked='true'] .theme-switch__thumb { transform: translateX(18px); }

.layout-header__github { width: 36px; margin-left: 6px; border-radius: 6px; }
.layout-header__github:hover { color: var(--ui-text); }
.layout-header__github:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: -2px; }

@media (prefers-reduced-motion: reduce) {
  .theme-switch__track, .theme-switch__thumb { transition: none; }
}

@media (max-width: 1240px) {
  .layout-header--appium { grid-template-columns: minmax(0, 1fr) auto; }
  .layout-header__appium { grid-area: 2 / 1 / 3 / -1; min-width: 0; }
}

@media (max-width: 800px) {
  .layout-header { padding-inline: 10px; column-gap: 6px; }
  .layout-header__breadcrumb { display: none; }
  .layout-header__appearance { padding-inline: 6px; }
  .layout-header__github { width: 32px; margin-left: 0; }
}
</style>
