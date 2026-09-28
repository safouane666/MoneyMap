/**
 * Optional Sentry wiring (P7.1).
 * No-ops when SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is unset.
 * When a DSN is set, install `@sentry/nextjs` and replace the body of `initSentry`
 * with a real `Sentry.init` call — do not invent a SaaS account or commit a DSN.
 */

function dsn(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    process.env.SENTRY_DSN?.trim() ||
    ''
  );
}

let warned = false;

export function initSentry(): void {
  const value = dsn();
  if (!value) return;
  if (warned) return;
  warned = true;
  // Stub only: keep the app runnable without @sentry/nextjs installed.
  console.info(
    '[sentry] DSN is set but the optional SDK stub is inactive. Install @sentry/nextjs and wire init to enable crash reporting.',
  );
}

export function captureException(_error: unknown): void {
  // no-op until a real Sentry client is wired in initSentry
}

export function isSentryConfigured(): boolean {
  return Boolean(dsn());
}
