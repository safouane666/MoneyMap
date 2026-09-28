/**
 * Optional Sentry wiring (P7.1).
 * No-ops when EXPO_PUBLIC_SENTRY_DSN is unset.
 * When a DSN is set, install `sentry-expo` (or `@sentry/react-native`) and
 * replace the body of `initSentry` with a real SDK init.
 */

function dsn(): string {
  return process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || '';
}

let warned = false;

export function initSentry(): void {
  const value = dsn();
  if (!value) return;
  if (warned) return;
  warned = true;
  console.info(
    '[sentry] EXPO_PUBLIC_SENTRY_DSN is set but the optional SDK stub is inactive. Install sentry-expo and wire init to enable crash reporting.',
  );
}

export function captureException(_error: unknown): void {
  // no-op until a real Sentry client is wired in initSentry
}

export function isSentryConfigured(): boolean {
  return Boolean(dsn());
}
