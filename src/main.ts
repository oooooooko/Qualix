import { computed, createApp, h, watch } from 'vue';
import ElementPlus, { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';
import 'element-plus/dist/index.css';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import App from './App.vue';
import { locale, t } from './i18n';
import './style.css';

const elementLocale = computed(() => locale.value === 'zh-CN' ? zhCn : en);
watch(locale, value => {
  document.documentElement.lang = value;
  document.title = t('Qualix 移动自动化平台');
}, { immediate: true });
createApp({ setup: () => () => h(ElConfigProvider, { locale: elementLocale.value }, () => h(App)) })
  .use(ElementPlus).mount('#app');
