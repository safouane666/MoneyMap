import { describe, expect, it } from 'vitest';
import { getBillingConfig } from './billing';

describe('billing config', () => {
  it('hides payment UI in default beta free mode', () => {
    const cfg = getBillingConfig();
    expect(cfg.showPaymentUi).toBe(false);
  });
});
