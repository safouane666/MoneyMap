import { createId } from '@clear-money/domain';
import { fakeAiMonthlyReport, fakeOcrReceipt, ProviderUnavailableError } from './providers.js';
import type { ExportResult, JobRecord, JobResult, JobType } from './types.js';
import { JOB_TYPES } from './types.js';

export function isJobType(value: string): value is JobType {
  return (JOB_TYPES as readonly string[]).includes(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function buildExport(
  format: 'xlsx' | 'pdf',
  payload: Record<string, unknown>,
): ExportResult {
  const spaceId = asString(payload.spaceId, 'space');
  const range = asString(payload.range, 'custom');
  const generated = new Date().toISOString().slice(0, 10);
  const filename = `ClearMoney_${spaceId}_${format}_${range}_${generated}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
  const storageKey = `exports/${spaceId}/${createId('job')}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;

  return {
    kind: 'export',
    format,
    filename,
    storageKey,
    sheets:
      format === 'xlsx'
        ? [
            'Transactions',
            'Summary',
            'Categories',
            'Members',
            'Goals',
            'Time Analysis',
            'Change Log',
          ]
        : undefined,
    requiresConfirmation: false,
  };
}

/**
 * Pure-ish handler: runs provider work for a job.
 * Idempotent callers should skip when status is already succeeded.
 */
export async function runJobHandler(job: JobRecord): Promise<JobResult> {
  if (!isJobType(job.type)) {
    throw new Error(`Unknown job type: ${job.type}`);
  }

  const payload = job.payload ?? {};

  switch (job.type) {
    case 'ocr_receipt':
      return fakeOcrReceipt({
        attachmentId: asString(payload.attachmentId),
        storageKey: asString(payload.storageKey),
        currency: asString(payload.currency, 'USD'),
      });

    case 'ai_monthly_report': {
      const spaceId = asString(payload.spaceId, job.spaceId ?? '');
      if (!spaceId) {
        throw new Error('ai_monthly_report requires spaceId');
      }
      return fakeAiMonthlyReport({
        spaceId,
        periodLabel: asString(payload.periodLabel, 'This month'),
        currency: asString(payload.currency, 'USD'),
        totals: {
          incomeMinor: asNumber(payload.incomeMinor),
          expenseMinor: asNumber(payload.expenseMinor),
          netMinor: asNumber(payload.netMinor),
        },
      });
    }

    case 'export_xlsx':
      return buildExport('xlsx', payload);

    case 'export_pdf':
      return buildExport('pdf', payload);

    default: {
      const _exhaustive: never = job.type;
      throw new Error(`Unhandled job type: ${_exhaustive}`);
    }
  }
}

export function failureMessage(err: unknown): string {
  if (err instanceof ProviderUnavailableError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Unknown worker error';
}
