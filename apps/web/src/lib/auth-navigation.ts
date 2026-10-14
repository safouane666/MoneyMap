/**
 * After email/password (or any cookie-setting) auth, use a full document
 * navigation — not Next soft routing.
 *
 * LedgerProvider mounts once in the root layout. Soft `router.push` after
 * sign-in leaves it stuck in the pre-auth guest/offline state, so the app
 * shell still shows “Sign in” and looks like a login loop.
 */
export function continueAfterAuth(nextPath: string): void {
  const path = nextPath.startsWith('/') ? nextPath : '/app/home';
  if (typeof window === 'undefined') return;
  window.location.assign(path);
}
