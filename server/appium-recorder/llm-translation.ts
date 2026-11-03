import { llmMessages, uiMessages, type Locale } from '../../locales';

export function makeLlmTranslator(locale: Locale) {
  return (source: string, params: Record<string, unknown> = {}): string => {
    const translated = llmMessages[locale][source] ?? uiMessages[locale][source.trim().replace(/\s+/g, ' ')] ?? source;
    return translated.replace(/\{(\d+)\}/g, (token, key: string) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : token);
  };
}
