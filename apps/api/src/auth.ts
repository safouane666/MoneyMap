import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb } from '@clear-money/db';
import * as schema from '@clear-money/db';
import { createId } from '@clear-money/domain';
import { config } from './config.js';

type AuthApi = {
  handler: (request: Request) => Promise<Response> | Response;
  api: {
    getSession: (args: { headers: Headers }) => Promise<{ user?: { id: string } } | null>;
  };
};

let _auth: AuthApi | undefined;

function publicOrigin(): string {
  // Better Auth breaks if baseURL contains a path (e.g. …/cm-api). Origin only.
  try {
    return new URL(config.authUrl).origin;
  } catch {
    return config.webUrl || 'http://localhost:8259';
  }
}

export function getAuth(): AuthApi {
  if (_auth) return _auth;
  const db = createDb(config.databaseUrl);

  const options: Record<string, unknown> = {
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: config.authSecret,
    baseURL: publicOrigin(),
    // Browser hits /cm-api/auth/* via the Next proxy (same origin as the web app).
    basePath: '/cm-api/auth',
    // Static list + request Origin when it is Tailscale MagicDNS (*.ts.net).
    trustedOrigins: async (request?: Request) => {
      const extras: string[] = [];
      const origin = request?.headers.get('origin') ?? request?.headers.get('referer');
      if (origin) {
        try {
          const u = new URL(origin);
          if (u.hostname.endsWith('.ts.net')) extras.push(u.origin);
        } catch {
          /* ignore */
        }
      }
      return [...config.webOrigins, 'clearmoney://', ...extras];
    },
    emailAndPassword: { enabled: true },
    account: {
      accountLinking: {
        enabled: true,
        // Same email via Google ↔ password: auto-link (demo has no email verify flow).
        trustedProviders: ['google'],
        requireLocalEmailVerified: false,
      },
    },
    advanced: {
      // Secure cookies whenever we are in production or serving over HTTPS.
      useSecureCookies:
        config.appEnv === 'production' ||
        config.webUrl.startsWith('https://') ||
        publicOrigin().startsWith('https://'),
      database: {
        generateId: () => createId('user'),
      },
    },
    user: {
      additionalFields: {
        locale: { type: 'string', defaultValue: 'en', required: false },
        defaultCurrency: { type: 'string', defaultValue: 'USD', required: false },
        timezone: { type: 'string', defaultValue: 'UTC', required: false },
        weekStartsOn: { type: 'number', defaultValue: 1, required: false },
        setupCompletedAt: { type: 'date', required: false },
        plan: { type: 'string', defaultValue: 'free', required: false },
      },
    },
  };

  if (config.googleClientId && config.googleClientSecret) {
    options.socialProviders = {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        // Google forbids raw private IPs (192.168.x / 10.x). Loopback is allowed.
        redirectURI: config.googleRedirectUri,
      },
    };
  }

  _auth = betterAuth(options as never) as unknown as AuthApi;
  return _auth;
}
