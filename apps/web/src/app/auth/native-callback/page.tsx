import { cookies } from 'next/headers';
import Link from 'next/link';

/**
 * Bridge after Better Auth Google OAuth for the native app.
 * Reads the session cookie (same-origin via /cm-api) and deep-links into
 * Clear Money with the cookie pair for SecureStore.
 *
 * Query: `to` = encodeURIComponent(deepLink), optional `migrate=1` for guest transfer.
 */
export default async function NativeAuthCallback({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; migrate?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const secure = jar.get('__Secure-better-auth.session_token')?.value;
  const plain = jar.get('better-auth.session_token')?.value;
  const token = secure || plain;
  const cookieName = secure
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token';

  let deepLink = 'penny://auth/callback';
  if (params.to) {
    try {
      const decoded = decodeURIComponent(params.to);
      if (
        decoded.startsWith('penny://') ||
        decoded.startsWith('exp://') ||
        decoded.startsWith('exps://')
      ) {
        deepLink = decoded;
      }
    } catch {
      /* keep default */
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-canvas px-6 text-center text-ink">
        <p className="text-lg font-semibold">Sign-in did not finish</p>
        <p className="text-sm text-ink-secondary">No session cookie was found. Try again from the app.</p>
        <Link href="/auth/sign-in" className="text-brand underline">
          Back to sign in
        </Link>
      </main>
    );
  }

  const base = deepLink.split('?')[0] ?? deepLink;
  const qs = new URLSearchParams();
  qs.set('session', `${cookieName}=${token}`);
  if (params.migrate === '1') qs.set('migrate', '1');
  const href = `${base}?${qs.toString()}`;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center text-ink">
      <p className="text-lg font-semibold">Opening Penny…</p>
      <p className="text-sm text-ink-secondary">You can close this tab after the app opens.</p>
      <a
        href={href}
        className="rounded-[var(--cm-radius-control)] bg-brand px-4 py-2 text-sm font-semibold text-white"
      >
        Open app
      </a>
      <script
        dangerouslySetInnerHTML={{
          __html: `try { window.location.replace(${JSON.stringify(href)}); } catch (e) {}
setTimeout(function(){ try { window.location.href = ${JSON.stringify(href)}; } catch (e) {} }, 400);`,
        }}
      />
    </main>
  );
}
