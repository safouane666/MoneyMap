import { describe, expect, it } from 'vitest';
import { hasMessage, listShippedLocales, t } from './index.js';

describe('t', () => {
  it('returns English for en', () => {
    expect(t('en', 'nav.home')).toBe('Home');
  });

  it('resolves recurring copy like web home', () => {
    expect(t('en', 'recurring.salaryTitle')).toBe('Salary & income');
    expect(t('en', 'recurring.addSalary')).toBe('Add income');
    expect(t('en', 'recurring.subscriptionsEmpty')).toBe('No subscriptions yet.');
  });

  it('resolves BCP 47 region tags to language bundle', () => {
    expect(t('fr-FR', 'nav.home')).toBe('Accueil');
    expect(t('ar-TN', 'nav.home')).toBe('الرئيسية');
  });

  it('falls back to English for unknown locales', () => {
    expect(t('ja-JP', 'nav.home')).toBe('Home');
  });

  it('falls back to English for missing keys in a shipped locale', () => {
    expect(t('fr', 'does.not.exist')).toBe('does.not.exist');
  });

  it('interpolates params', () => {
    expect(t('en', 'setup.progress', { step: 2, total: 5 })).toBe('2 of 5');
    expect(t('fr', 'spaces.limitReached', { limit: 1 })).toContain('1');
  });

  it('ships three bundles with matching coverage', () => {
    const locales = listShippedLocales();
    expect(locales.map((l) => l.code).sort()).toEqual(['ar', 'en', 'fr']);
    const counts = new Set(locales.map((l) => l.keys));
    expect(counts.size).toBe(1);
  });

  it('hasMessage checks English fallback', () => {
    expect(hasMessage('ja', 'nav.home')).toBe(true);
    expect(hasMessage('en', 'missing.key')).toBe(false);
  });
});
