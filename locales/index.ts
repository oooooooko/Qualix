import zhUi from './zh-CN/ui.json';
import enUi from './en/ui.json';
import zhLlm from './zh-CN/llm.json';
import enLlm from './en/llm.json';
import zhHelp from './zh-CN/help.json';
import enHelp from './en/help.json';

export const languages = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
] as const;
export type Locale = typeof languages[number]['code'];
export const uiMessages: Record<Locale, Readonly<Record<string, string>>> = { 'zh-CN': zhUi, en: enUi };
export const llmMessages: Record<Locale, Readonly<Record<string, string>>> = { 'zh-CN': zhLlm, en: enLlm };
export const helpMessages: Record<Locale, Readonly<Record<string, string>>> = { 'zh-CN': zhHelp, en: enHelp };
export const LANGUAGE_STORAGE_KEY = 'qualix:ui-language';
export function normalizeLocale(value: unknown): Locale {
  if (value === 'zh') return 'zh-CN';
  return languages.find(language => language.code === value)?.code ?? 'zh-CN';
}
