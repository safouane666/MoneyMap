import {
  buildPublicBillingConfig,
  type BillingMode,
  type BillingPublicConfig,
  type PlanId,
} from '@clear-money/domain';

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function numEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getBillingConfig(): BillingPublicConfig {
  return buildPublicBillingConfig({
    billingMode: (process.env.NEXT_PUBLIC_BILLING_MODE as BillingMode) || 'disabled',
    billingEnabled: boolEnv(process.env.NEXT_PUBLIC_BILLING_ENABLED, false),
    betaFreeMode: boolEnv(process.env.NEXT_PUBLIC_BETA_FREE_MODE, true),
    defaultPlan: (process.env.NEXT_PUBLIC_DEFAULT_PLAN as PlanId) || 'free',
    planFreeEnabled: boolEnv(process.env.NEXT_PUBLIC_PLAN_FREE_ENABLED, true),
    planPlusEnabled: boolEnv(process.env.NEXT_PUBLIC_PLAN_PLUS_ENABLED, false),
    planPlusMonthlyPrice: numEnv(process.env.NEXT_PUBLIC_PLAN_PLUS_MONTHLY_PRICE, 4.99),
    planPlusAnnualPrice: numEnv(process.env.NEXT_PUBLIC_PLAN_PLUS_ANNUAL_PRICE, 39.99),
  });
}
