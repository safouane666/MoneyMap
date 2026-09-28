import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:3011').replace(/\/$/, '');

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

async function proxy(req: NextRequest, pathParts: string[]) {
  // Auth lives at /cm-api/auth on the API. Other routes stay at the API root.
  const path = pathParts.map(encodeURIComponent).join('/');
  const isAuth = pathParts[0] === 'auth';
  const target = isAuth
    ? `${INTERNAL}/cm-api/${path}${req.nextUrl.search}`
    : `${INTERNAL}/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const host = req.headers.get('host') ?? 'localhost:8259';
  headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', '') || 'http');
  if (!headers.has('origin')) {
    headers.set('origin', `${req.nextUrl.protocol}//${host}`);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { error: 'Upstream API unreachable', code: 'upstream_unreachable' },
      { status: 502 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === 'set-cookie') return;
    out.append(key, value);
  });

  const setCookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [];
  for (const cookie of setCookies) {
    // Ensure cookies work on the web origin (8259), not only the API port
    out.append('set-cookie', cookie);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
