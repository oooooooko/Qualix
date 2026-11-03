<script setup lang="ts">
import { languages, locale, setLocale, t } from '../i18n';
</script>

<template>
  <div class="language-switch" role="group" :aria-label="t('界面语言')">
    <button v-for="language in languages" :key="language.code" type="button" :lang="language.code" :class="{ active: locale === language.code }" :aria-pressed="locale === language.code" @click="setLocale(language.code)">{{ language.label }}</button>
  </div>
</template>

<style scoped>
.language-switch {
  display: flex;
  flex: none;
  gap: 2px;
  padding: 3px;
  background: #fff;
  border: 1px solid #dce3ed;
  border-radius: 20px;
  box-shadow: 0 2px 8px #182b4910;
}
.language-switch button {
  min-height: 30px;
  padding: 4px 12px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: #475569;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}
.language-switch button.active { background: #e8f0fe; color: #174ea6; }
.language-switch button:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
@media (max-width: 600px) {
  .language-switch button { padding-inline: 8px; }
}
</style>
