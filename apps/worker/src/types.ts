/** Job type strings stored on the jobs table. */
export const JOB_TYPES = [
  'ocr_receipt',
  'ai_monthly_report',
  'export_xlsx',
  'export_pdf',
  'post_due_recurring',
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface JobRecord {
  id: string;
  type: string;
  status: string;
  spaceId: string | null;
  userId: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  idempotencyKey: string | null;
}

export interface OcrDraftResult {
  kind: 'ocr_draft';
  requiresConfirmation: true;
  draft: {
    amountMinor: number | null;
    currency: string;
    merchant: string | null;
    occurredAt: string | null;
    categoryHint: string | null;
    confidence: Record<string, number>;
  };
  provider: 'fake-ocr';
}

export interface AiReportDraftResult {
  kind: 'ai_monthly_report_draft';
  requiresConfirmation: true;
  draft: {
    periodLabel: string;
    spaceId: string;
    narrative: string;
    figures: Array<{ label: string; amountMinor: number; currency: string }>;
    caveats: string[];
  };
  provider: 'fake-ai';
}

export interface ExportResult {
  kind: 'export';
  format: 'xlsx' | 'pdf';
  filename: string;
  /** Planned object-storage key — bytes are not uploaded yet. */
  storageKey: string;
  /** False until a real file is written to storage. */
  bytesUploaded: false;
  sheets?: string[];
  requiresConfirmation: false;
}

export interface PostDueRecurringJobResult {
  kind: 'post_due_recurring';
  posted: number;
  skipped: number;
  transactionIds: string[];
  requiresConfirmation: false;
}

export type JobResult =
  | OcrDraftResult
  | AiReportDraftResult
  | ExportResult
  | PostDueRecurringJobResult;
