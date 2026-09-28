/**
 * Map internal / provider failure strings to safe user-facing copy (P7.2).
 */

export function sanitizeJobError(raw: string | null | undefined): {
  error: string | null;
  errorCode: string | null;
} {
  if (!raw) return { error: null, errorCode: null };

  if (/AI_API_KEY|not configured/i.test(raw)) {
    return {
      error: 'AI reports are not configured on this server.',
      errorCode: 'ai_not_configured',
    };
  }

  if (/provider|openai|anthropic|phronexus|ECONNREFUSED|fetch failed|ENOTFOUND/i.test(raw)) {
    return {
      error: 'A background job provider failed. Try again later.',
      errorCode: 'provider_error',
    };
  }

  if (raw.length > 160) {
    return { error: 'Job failed.', errorCode: 'job_failed' };
  }

  return { error: raw, errorCode: 'job_failed' };
}

export function publicInternalError(): { error: string; code: string } {
  return { error: 'Internal server error', code: 'internal_error' };
}
