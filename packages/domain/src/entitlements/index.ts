export type PlanId = 'free' | 'plus' | 'shared' | 'business';

export type FeatureFlag =
  | 'manual_transactions'
  | 'basic_reports'
  | 'csv_export'
  | 'unlimited_spaces'
  | 'goals'
  | 'penny_chat'
  | 'receipt_attachments'
  | 'receipt_scanning'
  | 'ai_monthly_report'
  | 'pdf_export'
  | 'shared_members'
  | 'roles'
  | 'comments'
  | 'approvals'
  | 'advanced_permissions'
  | 'cost_centers'
  | 'accounting_exports'
  | 'integrations';

export type BillingMode = 'disabled' | 'free' | 'sandbox' | 'live';

export interface BillingPublicConfig {
  billingMode: BillingMode;
  billingEnabled: boolean;
  betaFreeMode: boolean;
  defaultPlan: PlanId;
  plans: Array<{
    id: PlanId;
    enabled: boolean;
    available: boolean;
    label: string;
    monthlyPrice: number | null;
    annualPrice: number | null;
    features: FeatureFlag[];
  }>;
  showPaymentUi: boolean;
}

export interface EntitlementContext {
  plan: PlanId;
  personalSpaceCount: number;
  totalSpaceCount: number;
  usage: {
    receiptScans: number;
    aiRequests: number;
    generatedReports: number;
    activeMembers: number;
  };
  limits: {
    receiptScans: number;
    aiRequests: number;
    generatedReports: number;
    activeMembers: number;
  };
}

/** @deprecated Spaces are unlimited on free; kept for older callers. */
export const FREE_MAX_SPACES = Number.POSITIVE_INFINITY;

const PLAN_FEATURES: Record<PlanId, FeatureFlag[]> = {
  // Habit + 2-person share free. OCR / PDF / AI volume / large groups are Plus.
  free: [
    'manual_transactions',
    'basic_reports',
    'csv_export',
    'goals',
    'penny_chat',
    'shared_members',
  ],
  plus: [
    'manual_transactions',
    'basic_reports',
    'csv_export',
    'unlimited_spaces',
    'goals',
    'penny_chat',
    'receipt_attachments',
    'receipt_scanning',
    'ai_monthly_report',
    'pdf_export',
    'shared_members',
    'roles',
    'comments',
    'approvals',
  ],
  // Legacy plan id kept for existing rows; not sold. Treat like Plus capacity.
  shared: [
    'manual_transactions',
    'basic_reports',
    'csv_export',
    'unlimited_spaces',
    'goals',
    'penny_chat',
    'receipt_attachments',
    'receipt_scanning',
    'ai_monthly_report',
    'pdf_export',
    'shared_members',
    'roles',
    'comments',
    'approvals',
  ],
  business: [
    'manual_transactions',
    'basic_reports',
    'csv_export',
    'unlimited_spaces',
    'goals',
    'penny_chat',
    'receipt_attachments',
    'receipt_scanning',
    'ai_monthly_report',
    'pdf_export',
    'shared_members',
    'roles',
    'comments',
    'approvals',
    'advanced_permissions',
    'cost_centers',
    'accounting_exports',
    'integrations',
  ],
};

export function planHasFeature(plan: PlanId, feature: FeatureFlag): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

export function canCreateSpace(_ctx: EntitlementContext): { ok: boolean; reason?: string } {
  // Spaces are not plan-gated — create as many personal / household / shared spaces as needed.
  return { ok: true };
}

export function canInviteMember(ctx: EntitlementContext): { ok: boolean; reason?: string } {
  return canUseFeature(ctx, 'shared_members');
}

export function canUseFeature(
  ctx: EntitlementContext,
  feature: FeatureFlag,
): { ok: boolean; reason?: string } {
  if (!planHasFeature(ctx.plan, feature)) {
    return { ok: false, reason: `Feature ${feature} requires a higher plan.` };
  }
  if (feature === 'receipt_scanning' && ctx.usage.receiptScans >= ctx.limits.receiptScans) {
    return { ok: false, reason: 'Receipt scan allowance exhausted.' };
  }
  if (
    (feature === 'ai_monthly_report' || feature === 'penny_chat') &&
    ctx.usage.aiRequests >= ctx.limits.aiRequests
  ) {
    return {
      ok: false,
      reason:
        feature === 'penny_chat'
          ? 'Penny allowance exhausted this month.'
          : 'AI report allowance exhausted.',
    };
  }
  if (feature === 'pdf_export' && ctx.usage.generatedReports >= ctx.limits.generatedReports) {
    return { ok: false, reason: 'Report generation allowance exhausted.' };
  }
  if (feature === 'shared_members' && ctx.usage.activeMembers >= ctx.limits.activeMembers) {
    return {
      ok: false,
      reason:
        ctx.limits.activeMembers <= 2
          ? 'Free shared spaces include you plus one invite. Plus unlocks larger groups.'
          : 'Member limit reached for this plan.',
    };
  }
  return { ok: true };
}

/** Free plan: 3 active goals. Plus+: unlimited (null). */
export function maxActiveGoalsForPlan(plan: PlanId): number | null {
  if (plan === 'free') return 3;
  return null;
}

export function buildPublicBillingConfig(env: {
  billingMode: BillingMode;
  billingEnabled: boolean;
  betaFreeMode: boolean;
  defaultPlan: PlanId;
  planFreeEnabled: boolean;
  planPlusEnabled: boolean;
  planPlusMonthlyPrice: number;
  planPlusAnnualPrice: number;
}): BillingPublicConfig {
  const showPaymentUi =
    env.billingEnabled &&
    !env.betaFreeMode &&
    (env.billingMode === 'sandbox' || env.billingMode === 'live');

  return {
    billingMode: env.billingMode,
    billingEnabled: env.billingEnabled && !env.betaFreeMode,
    betaFreeMode: env.betaFreeMode,
    defaultPlan: env.defaultPlan,
    showPaymentUi,
    plans: [
      {
        id: 'free',
        enabled: env.planFreeEnabled,
        available: true,
        label: 'Free',
        monthlyPrice: 0,
        annualPrice: 0,
        features: PLAN_FEATURES.free,
      },
      {
        id: 'plus',
        enabled: env.planPlusEnabled,
        available: env.planPlusEnabled && showPaymentUi,
        label: 'Plus',
        monthlyPrice: env.planPlusMonthlyPrice,
        annualPrice: env.planPlusAnnualPrice,
        features: PLAN_FEATURES.plus,
      },
      // Retired as a sellable SKU — 2-person share is Free; larger groups are Plus.
      {
        id: 'shared',
        enabled: false,
        available: false,
        label: 'Shared (included in Free)',
        monthlyPrice: null,
        annualPrice: null,
        features: PLAN_FEATURES.shared,
      },
      {
        id: 'business',
        enabled: false,
        available: false,
        label: 'Business (later)',
        monthlyPrice: null,
        annualPrice: null,
        features: PLAN_FEATURES.business,
      },
    ],
  };
}

export function defaultLimitsForPlan(plan: PlanId): EntitlementContext['limits'] {
  switch (plan) {
    case 'free':
      // 3 free receipt scans as a taste; generous Penny for early habit; owner + 1 invite.
      return { receiptScans: 3, aiRequests: 40, generatedReports: 0, activeMembers: 2 };
    case 'plus':
      return { receiptScans: 50, aiRequests: 200, generatedReports: 50, activeMembers: 10 };
    case 'shared':
      return { receiptScans: 100, aiRequests: 200, generatedReports: 100, activeMembers: 10 };
    case 'business':
      return { receiptScans: 500, aiRequests: 500, generatedReports: 500, activeMembers: 100 };
  }
}
