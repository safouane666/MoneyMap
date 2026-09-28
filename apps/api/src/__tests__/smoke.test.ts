import { describe, expect, it } from 'vitest';
import { gateBillingWebhook } from '../billing-webhook.js';
import { sanitizeJobError, publicInternalError } from '../public-errors.js';
import { maskEmail } from '../mask-email.js';
import { can, filterVisibleEntries, requiresConfirmation } from '@clear-money/domain';

/**
 * P7.5 smoke — documents what API package tests actually cover.
 * Full HTTP integration against Postgres is not in this suite; see `app.test.ts`
 * for additional domain/CSV contracts. ACCEPTANCE.md points here for honesty.
 */
describe('api smoke (P7.5)', () => {
  it('role matrix: viewer cannot create/invite', () => {
    expect(can('viewer', 'create')).toBe(false);
    expect(can('viewer', 'invite')).toBe(false);
    expect(can('owner', 'create')).toBe(true);
  });

  it('public invite email masking', () => {
    expect(maskEmail('friend@example.com')).toBe('fr***@example.com');
  });

  it('child visibility filter', () => {
    const rows = [
      { id: '1', createdBy: 'child_1' },
      { id: '2', createdBy: 'parent_1' },
    ];
    expect(filterVisibleEntries('child', 'child_1', rows)).toHaveLength(1);
  });

  it('voice/receipt drafts require confirmation', () => {
    expect(requiresConfirmation('voice')).toBe(true);
    expect(requiresConfirmation('receipt')).toBe(true);
  });
});

describe('billing webhook gate (P7.4)', () => {
  it('allows unsigned stub outside production', () => {
    expect(
      gateBillingWebhook({
        appEnv: 'development',
        billingMode: 'free',
        hasWebhookSecret: false,
        hasSignature: false,
        hasStripeSecret: false,
      }),
    ).toEqual({ action: 'allow_stub' });
  });

  it('rejects unsigned webhook in production with 501', () => {
    expect(
      gateBillingWebhook({
        appEnv: 'production',
        billingMode: 'live',
        hasWebhookSecret: false,
        hasSignature: false,
        hasStripeSecret: true,
      }),
    ).toMatchObject({ action: 'reject', status: 501, code: 'webhook_unsigned' });
  });

  it('requires verify when production has secret + signature', () => {
    expect(
      gateBillingWebhook({
        appEnv: 'production',
        billingMode: 'live',
        hasWebhookSecret: true,
        hasSignature: true,
        hasStripeSecret: true,
      }),
    ).toEqual({ action: 'verify_stripe' });
  });

  it('blocks live mode outside production', () => {
    expect(
      gateBillingWebhook({
        appEnv: 'development',
        billingMode: 'live',
        hasWebhookSecret: true,
        hasSignature: true,
        hasStripeSecret: true,
      }),
    ).toMatchObject({ action: 'reject', status: 400, code: 'webhook_live_nonprod' });
  });
});

describe('public error sanitization (P7.2)', () => {
  it('strips provider / AI key strings from job errors', () => {
    expect(sanitizeJobError('AI_API_KEY is not configured. Monthly AI reports…')).toMatchObject({
      errorCode: 'ai_not_configured',
    });
    expect(sanitizeJobError('AI provider error 502: phronexus timeout')).toMatchObject({
      errorCode: 'provider_error',
    });
    expect(sanitizeJobError('fetch failed')).toMatchObject({ errorCode: 'provider_error' });
  });

  it('exposes a stable internal error shape', () => {
    expect(publicInternalError()).toEqual({
      error: 'Internal server error',
      code: 'internal_error',
    });
  });
});
