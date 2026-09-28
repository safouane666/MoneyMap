/** Browser talks same-origin `/cm-api` (Next proxy). Server routes hit the API directly. */
function resolveApiBase(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_INTERNAL_URL ||
      'http://127.0.0.1:3011'
    ).replace(/\/$/, '');
  }
  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicUrl && /^https?:\/\//i.test(publicUrl)) {
    // Legacy absolute API URL (breaks phones when port 3011 is firewalled)
    return publicUrl.replace(/\/$/, '');
  }
  return (publicUrl || '/cm-api').replace(/\/$/, '') || '/cm-api';
}

export function getApiUrl(): string {
  return resolveApiBase();
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiResult<T> = { data: T; offline: false } | { data: null; offline: true };

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<ApiResult<T>> {
  const base = resolveApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const { timeoutMs = 12_000, ...rest } = init ?? {};
  try {
    const res = await fetch(url, {
      ...rest,
      credentials: 'include',
      headers: buildHeaders(rest.headers),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      const message =
        body && typeof body === 'object' && 'message' in body && typeof (body as { message: unknown }).message === 'string'
          ? (body as { message: string }).message
          : body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
            ? (body as { error: string }).error
            : `API ${res.status}`;
      throw new ApiError(message, res.status, body);
    }
    if (res.status === 204) {
      return { data: undefined as T, offline: false };
    }
    const data = (await res.json()) as T;
    return { data, offline: false };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return { data: null, offline: true };
  }
}

export async function startGoogleSignIn(callbackPath = '/app/home'): Promise<void> {
  // Prefer a relative path so Better Auth accepts it on any host (LAN / Tailscale / localhost).
  // Absolute URLs must be listed in API trustedOrigins — easy to miss for *.ts.net.
  const callbackURL = callbackPath.startsWith('http')
    ? callbackPath
    : callbackPath.startsWith('/')
      ? callbackPath
      : `/${callbackPath}`;

  const result = await apiFetch<{ url?: string; redirect?: boolean }>('/auth/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({ provider: 'google', callbackURL }),
  });

  if (result.offline) {
    throw new ApiError('API offline', 0);
  }
  const url = result.data?.url;
  if (!url) {
    throw new ApiError('Google sign-in unavailable', 500);
  }
  window.location.href = url;
}

/** @deprecated Prefer startGoogleSignIn — Better Auth social is POST-only. */
export function googleSignInUrl(callbackPath = '/app/home'): string {
  return `${resolveApiBase()}/auth/sign-in/social`;
}
