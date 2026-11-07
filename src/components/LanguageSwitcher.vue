<script setup lang="ts">
import { languages, locale, setLocale, t } from '../i18n';
</script>

<template>
  <el-dropdown trigger="click" placement="bottom-end" popper-class="language-switch-menu" @command="setLocale">
    <button type="button" class="language-switch" :aria-label="t('界面语言')" :title="t('界面语言')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m5 8 6 6m-7 0 6-6 2-3M2 5h12M7 2h1m13 20-5-10-5 10m2-4h6" />
      </svg>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <template #dropdown>
      <el-dropdown-menu class="language-switch__options">
        <el-dropdown-item
          v-for="language in languages"
          :key="language.code"
          :command="language.code"
          :lang="language.code"
          :aria-current="locale === language.code ? 'true' : undefined"
          class="language-switch__option"
        >
          {{ language.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.language-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--ui-text-secondary);
  cursor: pointer;
}

.language-switch:hover, .language-switch[aria-expanded='true'] { color: var(--ui-text); }

:global(.language-switch-menu.el-popper) { min-width: 128px; border-radius: 12px; }
:global(.language-switch-menu .el-popper__arrow) { display: none; }
.language-switch__options.el-dropdown-menu { padding: 10px; }
.language-switch__option.el-dropdown-menu__item { min-height: 32px; padding: 0 12px; border-radius: 6px; }
.language-switch__option[aria-current='true'] { font-weight: 600; }

@media (max-width: 800px) {
  .language-switch { padding-inline: 5px; }
}
</style>
