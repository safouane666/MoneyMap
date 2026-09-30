/**
 * Mobile i18n — import locale JSON from the workspace package by path so Metro
 * can always resolve them (package subpath exports are unreliable in RN).
 */
import ar from '../../../../packages/i18n/src/locales/ar.json';
import en from '../../../../packages/i18n/src/locales/en.json';
import fr from '../../../../packages/i18n/src/locales/fr.json';

export type MessageParams = Record<string, string | number>;

const BUNDLES: Record<string, Record<string, string>> = { en, fr, ar };

function languageTag(locale: string): string {
  return locale.replace('_', '-').split('-')[0]?.toLowerCase() ?? 'en';
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function t(locale: string, key: string, params?: MessageParams): string {
  const lang = languageTag(locale);
  const catalog = BUNDLES[lang] ?? BUNDLES.en!;
  const english = BUNDLES.en!;
  const template = catalog[key] ?? english[key];
  if (template === undefined) return key;
  return interpolate(template, params);
}
