export interface LocalePreferences {
  locale: string;
  language: string;
  region: string;
  currency: string;
  timezone: string;
  weekStartsOn: 0 | 1 | 6;
  direction: 'ltr' | 'rtl';
}

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

export function directionForLocale(locale: string): 'ltr' | 'rtl' {
  const lang = locale.split('-')[0]?.toLowerCase() ?? 'en';
  return RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
}

export function parseLocale(locale: string): LocalePreferences {
  const parts = locale.replace('_', '-').split('-');
  const language = parts[0]?.toLowerCase() ?? 'en';
  const region = (parts[1] ?? 'US').toUpperCase();
  return {
    locale: `${language}-${region}`,
    language,
    region,
    currency: 'USD',
    timezone: 'UTC',
    weekStartsOn: 1,
    direction: directionForLocale(locale),
  };
}

export function formatDate(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Language is open-ended — never hard-code a finite enum in business logic. */
export const SHIPPED_LOCALES = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
] as const;
