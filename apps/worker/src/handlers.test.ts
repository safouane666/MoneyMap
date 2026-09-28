import { describe, expect, it, afterEach } from 'vitest';
import { failureMessage, runJobHandler } from './handlers.js';
import { fakeAiMonthlyReport, ProviderUnavailableError } from './providers.js';
import type { JobRecord } from './types.js';

function job(partial: Partial<JobRecord> & Pick<JobRecord, 'type'>): JobRecord {
  return {
    id: 'job_test',
    status: 'running',
    spaceId: 'space_1',
    userId: 'user_1',
    payload: {},
    result: null,
    error: null,
    idempotencyKey: 'idem_test',
    ...partial,
  };
}

describe('providers', () => {
  const originalKey = process.env.AI_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
  });

  it('OCR returns a draft requiring confirmation', async () => {
    const result = await runJobHandler(
      job({ type: 'ocr_receipt', payload: { currency: 'TND' } }),
    );
    expect(result.kind).toBe('ocr_draft');
    if (result.kind === 'ocr_draft') {
      expect(result.requiresConfirmation).toBe(true);
      expect(result.draft.currency).toBe('TND');
      expect(result.draft.confidence.amountMinor).toBeGreaterThan(0);
    }
  });

  it('AI report fails gracefully without AI_API_KEY', () => {
    delete process.env.AI_API_KEY;
    expect(() =>
      fakeAiMonthlyReport({ spaceId: 'space_1', periodLabel: '2026-09' }),
    ).toThrow(ProviderUnavailableError);
  });

  it('AI report returns draft when key is present', async () => {
    process.env.AI_API_KEY = 'test-key';
    const result = await runJobHandler(
      job({
        type: 'ai_monthly_report',
        payload: {
          spaceId: 'space_1',
          periodLabel: '2026-09',
          incomeMinor: 10000,
          expenseMinor: 3000,
          netMinor: 7000,
        },
      }),
    );
    expect(result.kind).toBe('ai_monthly_report_draft');
    if (result.kind === 'ai_monthly_report_draft') {
      expect(result.requiresConfirmation).toBe(true);
      expect(result.draft.figures).toHaveLength(3);
      expect(result.draft.caveats.length).toBeGreaterThan(0);
    }
  });

  it('export_xlsx lists required sheets', async () => {
    const result = await runJobHandler(
      job({
        type: 'export_xlsx',
        payload: { spaceId: 'space_1', range: '2026-09' },
      }),
    );
    expect(result.kind).toBe('export');
    if (result.kind === 'export') {
      expect(result.format).toBe('xlsx');
      expect(result.bytesUploaded).toBe(false);
      expect(result.sheets).toEqual([
        'Transactions',
        'Summary',
        'Categories',
        'Members',
        'Goals',
        'Time Analysis',
        'Change Log',
      ]);
    }
  });

  it('export_pdf builds a storage key', async () => {
    const result = await runJobHandler(
      job({ type: 'export_pdf', payload: { spaceId: 'space_1', range: '2026-09' } }),
    );
    expect(result.kind).toBe('export');
    if (result.kind === 'export') {
      expect(result.format).toBe('pdf');
      expect(result.bytesUploaded).toBe(false);
      expect(result.storageKey).toContain('exports/');
    }
  });

  it('failureMessage surfaces provider errors', () => {
    expect(failureMessage(new ProviderUnavailableError('no key'))).toBe('no key');
  });
});
