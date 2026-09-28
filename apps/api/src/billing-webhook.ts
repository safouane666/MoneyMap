/**
 * Production gate for Stripe billing webhooks (P7.4).
 * Unsigned stubs are allowed in non-production only.
 */

export type WebhookGateResult =
  | { action: 'allow_stub' }
  | { action: 'verify_stripe' }
  | { action: 'reject'; status: 400 | 501; error: string; code: string };

export function gateBillingWebhook(input: {
  appEnv: string;
  billingMode: string | undefined;
  hasWebhookSecret: boolean;
  hasSignature: boolean;
  hasStripeSecret: boolean;
}): WebhookGateResult {
  if (input.billingMode === 'live' && input.appEnv !== 'production') {
    return {
      action: 'reject',
      status: 400,
      error: 'Live webhooks only in production',
      code: 'webhook_live_nonprod',
    };
  }

  if (input.appEnv === 'production') {
    if (!input.hasWebhookSecret || !input.hasSignature) {
      return {
        action: 'reject',
        status: 501,
        error: 'Webhook signature required in production',
        code: 'webhook_unsigned',
      };
    }
    if (!input.hasStripeSecret) {
      return {
        action: 'reject',
        status: 501,
        error: 'Stripe not configured for webhooks',
        code: 'webhook_not_configured',
      };
    }
    return { action: 'verify_stripe' };
  }

  return { action: 'allow_stub' };
}
