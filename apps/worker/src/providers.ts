import type { AiReportDraftResult, OcrDraftResult } from './types.js';

export class ProviderUnavailableError extends Error {
  override readonly name = 'ProviderUnavailableError';
  constructor(message: string) {
    super(message);
  }
}

/** Fake OCR — always returns a draft that requires user confirmation. */
export function fakeOcrReceipt(input: {
  attachmentId?: string;
  storageKey?: string;
  currency?: string;
}): OcrDraftResult {
  const currency = (input.currency as string | undefined) ?? 'USD';
  return {
    kind: 'ocr_draft',
    requiresConfirmation: true,
    draft: {
      amountMinor: 2450,
      currency,
      merchant: 'Demo Merchant',
      occurredAt: new Date().toISOString(),
      categoryHint: 'uncategorized',
      confidence: {
        amountMinor: 0.82,
        merchant: 0.71,
        occurredAt: 0.64,
        categoryHint: 0.4,
      },
    },
    provider: 'fake-ocr',
  };
}

/**
 * Fake AI monthly report.
 * Throws ProviderUnavailableError when AI_API_KEY is missing so the job
 * fails gracefully — core tracking stays independent.
 */
export function fakeAiMonthlyReport(input: {
  spaceId: string;
  periodLabel: string;
  currency?: string;
  totals?: { incomeMinor: number; expenseMinor: number; netMinor: number };
}): AiReportDraftResult {
  if (!process.env.AI_API_KEY) {
    throw new ProviderUnavailableError(
      'AI_API_KEY is not configured. Monthly AI reports are unavailable; manual tracking still works.',
    );
  }

  const currency = input.currency ?? 'USD';
  const totals = input.totals ?? { incomeMinor: 0, expenseMinor: 0, netMinor: 0 };

  return {
    kind: 'ai_monthly_report_draft',
    requiresConfirmation: true,
    draft: {
      periodLabel: input.periodLabel,
      spaceId: input.spaceId,
      narrative: [
        `Draft summary for ${input.periodLabel}.`,
        `Income ${totals.incomeMinor} ${currency} minus expenses ${totals.expenseMinor} ${currency}`,
        `gives a net of ${totals.netMinor} ${currency}.`,
        'This is a generated draft — confirm or edit before saving. Not tax, investment, or lending advice.',
      ].join(' '),
      figures: [
        { label: 'Income', amountMinor: totals.incomeMinor, currency },
        { label: 'Expenses', amountMinor: totals.expenseMinor, currency },
        { label: 'Net', amountMinor: totals.netMinor, currency },
      ],
      caveats: [
        'Generated content requires confirmation.',
        'Figures come only from the selected space and period.',
        'No investment, tax, or lending certainty.',
      ],
    },
    provider: 'fake-ai',
  };
}
