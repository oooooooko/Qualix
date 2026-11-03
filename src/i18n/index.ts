import { readonly, shallowRef } from 'vue';
import { languages, LANGUAGE_STORAGE_KEY, normalizeLocale, uiMessages, helpMessages, type Locale } from '../../locales';
export { languages, type Locale } from '../../locales';

function readPreference(): Locale {
  try { return normalizeLocale(typeof localStorage === 'undefined' ? undefined : localStorage.getItem(LANGUAGE_STORAGE_KEY)); }
  catch { return 'zh-CN'; }
}
const currentLocale = shallowRef<Locale>(readPreference());
export const locale = readonly(currentLocale);
export function setLocale(value: string) {
  currentLocale.value = normalizeLocale(value);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLocale.value); } catch { /* Language switching also works without storage. */ }
}

type Params = Record<string, unknown>;
const normalize = (text: string) => text.trim().replace(/\s+/g, ' ');
const patterns = Object.keys(uiMessages['zh-CN']).filter(key => /\{\d+\}/.test(key)).map(key => {
  const names: string[] = [];
  const escaped = key.split(/(\{\d+\})/).map(part => {
    if (/^\{\d+\}$/.test(part)) { names.push(part.slice(1, -1)); return '([\\s\\S]*?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { key, names, expression: new RegExp(`^${escaped}$`) };
});

/** Explicit UI translation only. User content must never be passed to this function. */
export function t(value: unknown, params: Params = {}): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (currentLocale.value === 'zh-CN') return text.replace(/\{(\d+)\}/g, (token, name: string) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token);
  const key = normalize(text);
  const messages = uiMessages[currentLocale.value];
  let translated = messages[key] ?? helpMessages[currentLocale.value][key];
  let substitutions = params;
  if (translated === undefined && /[\p{Script=Han}]/u.test(key)) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(key);
      if (!match) continue;
      translated = messages[pattern.key];
      substitutions = Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1] ?? '']));
      break;
    }
  }
  if (translated === undefined) translated = text;
  else translated = (text.match(/^\s*/)?.[0] ?? '') + translated + (text.match(/\s*$/)?.[0] ?? '');
  return translated.replace(/\{(\d+)\}/g, (token, name: string) => Object.prototype.hasOwnProperty.call(substitutions, name) ? String(substitutions[name]) : token);
}

/** Translate unchanged built-in examples without rewriting saved or custom presets. */
export function translateBuiltInPreset<T extends { name: string; prompt: string }>(preset: T, defaults: readonly T[]): T {
  return defaults.some(item => item.name === preset.name && item.prompt === preset.prompt)
    ? { ...preset, name: t(preset.name), prompt: t(preset.prompt) }
    : preset;
}
