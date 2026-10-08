import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_INTERNAL_URL ||
  'http://127.0.0.1:3011'
).replace(/\/$/, '');

/**
 * Bridges Better Auth Google OAuth into a system browser for the native app.
 *
 * Why: POST /auth/sign-in/social sets `__Secure-better-auth.state` on the
 * response. React Native fetch may not even expose Set-Cookie, and Chrome
 * Custom Tabs never share that jar. Opening Google directly → state_mismatch
 * → user lands on the web sign-in page (looks like "went to the webapp").
 *
 * This route runs IN the system browser: it starts social sign-in server-side,
 * forwards the state Set-Cookie onto this response, then 302s to Google.
 * Query: `callbackURL` = https://…/auth/native-callback?to=clearmoney://…
 */
export async function GET(req: NextRequest) {
  const callbackURL = req.nextUrl.searchParams.get('callbackURL');
  if (!callbackURL) {
    return NextResponse.json({ error: 'Missing callbackURL' }, { status: 400 });
  }

  let handoff: URL;
  try {
    handoff = new URL(callbackURL);
  } catch {
    return NextResponse.json({ error: 'Invalid callbackURL' }, { status: 400 });
  }

  // Only our own native handoff page (same origin) — never open arbitrary URLs.
  if (handoff.origin !== req.nextUrl.origin || handoff.pathname !== '/auth/native-callback') {
    return NextResponse.json({ error: 'callbackURL must be /auth/native-callback' }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  let upstream: Response;
  try {
    upstream = await fetch(`${INTERNAL}/cm-api/auth/sign-in/social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'X-Forwarded-Host': req.headers.get('host') ?? 'localhost',
        'X-Forwarded-Proto': req.nextUrl.protocol.replace(':', '') || 'https',
      },
      body: JSON.stringify({ provider: 'google', callbackURL: handoff.toString() }),
      redirect: 'manual',
    });
  } catch {
    return NextResponse.json({ error: 'Auth API unreachable' }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return NextResponse.json(
      { error: 'Google sign-in unavailable', detail: text.slice(0, 200) },
      { status: 502 },
    );
  }

  let data: { url?: string };
  try {
    data = (await upstream.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid auth response' }, { status: 502 });
  }
  if (!data.url) {
    return NextResponse.json({ error: 'Google sign-in unavailable' }, { status: 502 });
  }

  let google: URL;
  try {
    google = new URL(data.url);
  } catch {
    return NextResponse.json({ error: 'Invalid Google URL' }, { status: 502 });
  }
  if (google.hostname !== 'accounts.google.com' && !google.hostname.endsWith('.google.com')) {
    return NextResponse.json({ error: 'Non-Google OAuth URL rejected' }, { status: 502 });
  }

  const out = NextResponse.redirect(google.toString(), 302);
  const setCookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      out.headers.append('set-cookie', cookie);
    }
  } else {
    // Node fetch may collapse to a single header.
    const single = upstream.headers.get('set-cookie');
    if (single) out.headers.append('set-cookie', single);
  }
  return out;
}
