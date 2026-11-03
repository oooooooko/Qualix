import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal, OnDestroy } from '@angular/core';
import { artemisMessages, languages, LANGUAGE_STORAGE_KEY, normalizeLocale, type Locale } from '../../../../../../../locales';
export { LANGUAGE_STORAGE_KEY } from '../../../../../../../locales';
export type UiLanguage = Locale;

const templates = Object.keys(artemisMessages.en).filter(key => /\{\d+\}/.test(key)).map(key => ({
  key,
  expression: new RegExp('^' + key.split(/(\{\d+\})/).map(part => /^\{\d+\}$/.test(part)
    ? '([\\s\\S]*?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$'),
}));

/** The host Settings page owns the preference; task/model/device content stays unchanged. */
@Injectable({ providedIn: 'root' })
export class LanguageService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<Locale>(this.readPreference());
  readonly language = this.current.asReadonly();
  private readonly onHostMessage = (event: MessageEvent) => {
    const view = this.document.defaultView;
    if (!view || event.source !== view.parent || view.parent === view) return;
    const origin = this.parentOrigin();
    if (!origin || event.origin !== origin || event.data?.type !== 'qualix:language') return;
    if (!languages.some(language => language.code === event.data.locale)) return;
    this.setLanguage(event.data.locale);
  };

  constructor() {
    this.updateDocument();
    this.document.defaultView?.addEventListener?.('message', this.onHostMessage);
  }
  ngOnDestroy(): void { this.document.defaultView?.removeEventListener?.('message', this.onHostMessage); }

  setLanguage(language: Locale | 'zh'): void {
    this.current.set(normalizeLocale(language));
    this.updateDocument();
    try { this.document.defaultView?.localStorage.setItem(LANGUAGE_STORAGE_KEY, this.language()); } catch { /* Storage can be blocked in an embedded browser. */ }
  }

  translate(value: string | null | undefined): string {
    if (!value) return '';
    const key = value.replace(/\s+/g, ' ').trim();
    const messages = artemisMessages[this.language()];
    let translated = messages[key];
    if (translated === undefined) {
      for (const template of templates) {
        const match = template.expression.exec(key);
        if (!match) continue;
        translated = (messages[template.key] ?? template.key).replace(/\{(\d+)\}/g, (_token, index: string) => match[Number(index) + 1] ?? '');
        break;
      }
    }
    return translated === undefined ? value : (value.match(/^\s*/)?.[0] ?? '') + translated + (value.match(/\s*$/)?.[0] ?? '');
  }

  private readPreference(): Locale {
    try {
      const requested = new URL(this.document.defaultView?.location?.href ?? 'http://localhost').searchParams.get('uiLanguage');
      if (languages.some(language => language.code === requested)) return normalizeLocale(requested);
      const storage = this.document.defaultView?.localStorage;
      return normalizeLocale(storage?.getItem(LANGUAGE_STORAGE_KEY) ?? storage?.getItem('artemis.ui.language'));
    } catch { return 'zh-CN'; }
  }
  private parentOrigin(): string {
    try {
      const value = new URL(this.document.defaultView?.location?.href ?? 'http://localhost').searchParams.get('parentOrigin');
      return value ? new URL(value).origin : '';
    } catch { return ''; }
  }
  private updateDocument(): void { this.document.documentElement.lang = this.language(); }
}
