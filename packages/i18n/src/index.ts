import ar from './locales/ar.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };

export type MessageCatalog = Record<string, string>;
export type MessageParams = Record<string, string | number>;

/** Shipped bundles only — language remains open-ended in domain logic (BCP 47). */
export const SHIPPED_BUNDLES: Readonly<Record<string, MessageCatalog>> = {
  en,
  fr,
  ar,
};

export const DEFAULT_LOCALE = 'en';

function languageTag(locale: string): string {
  return locale.replace('_', '-').split('-')[0]?.toLowerCase() ?? DEFAULT_LOCALE;
}

function resolveCatalog(locale: string): MessageCatalog {
  const lang = languageTag(locale);
  return SHIPPED_BUNDLES[lang] ?? SHIPPED_BUNDLES[DEFAULT_LOCALE]!;
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

/**
 * Translate a message key for a BCP 47 locale.
 * Falls back to English when the locale or key is missing.
 */
export function t(locale: string, key: string, params?: MessageParams): string {
  const catalog = resolveCatalog(locale);
  const english = SHIPPED_BUNDLES[DEFAULT_LOCALE]!;
  const template = catalog[key] ?? english[key] ?? key;
  return interpolate(template, params);
}

export function hasMessage(locale: string, key: string): boolean {
  const catalog = resolveCatalog(locale);
  return key in catalog || key in SHIPPED_BUNDLES[DEFAULT_LOCALE]!;
}

export function listShippedLocales(): Array<{ code: string; keys: number }> {
  return Object.entries(SHIPPED_BUNDLES).map(([code, catalog]) => ({
    code,
    keys: Object.keys(catalog).length,
  }));
}

export { en, fr, ar };
