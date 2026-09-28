import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPublicBillingConfig,
  type BillingMode,
  type PlanId,
} from '@clear-money/domain';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });
loadEnv();

export function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export function billingPublicConfig() {
  return buildPublicBillingConfig({
    billingMode: (env('BILLING_MODE', 'disabled') as BillingMode) || 'disabled',
    billingEnabled: env('BILLING_ENABLED', 'false') === 'true',
    betaFreeMode: env('BETA_FREE_MODE', 'true') === 'true',
    defaultPlan: (env('DEFAULT_PLAN', 'free') as PlanId) || 'free',
    planFreeEnabled: env('PLAN_FREE_ENABLED', 'true') !== 'false',
    planPlusEnabled: env('PLAN_PLUS_ENABLED', 'false') === 'true',
    planPlusMonthlyPrice: Number(env('PLAN_PLUS_MONTHLY_PRICE', '4.99')),
    planPlusAnnualPrice: Number(env('PLAN_PLUS_ANNUAL_PRICE', '39.99')),
  });
}

export const config = {
  port: Number(env('PORT', env('API_PORT', '3001'))),
  webUrl: env('WEB_URL', 'http://localhost:8259'),
  authSecret: env('BETTER_AUTH_SECRET', 'dev-secret-change-me-to-32-chars-min'),
  // Cookie/host origin for Better Auth (web origin when using /cm-api proxy — not the API port).
  authUrl: env('BETTER_AUTH_URL', env('WEB_URL', 'http://localhost:8259')),
  databaseUrl:
    env('DATABASE_URL') || 'postgresql://clearmoney:clearmoney@localhost:5433/clearmoney',
  googleClientId: env('GOOGLE_CLIENT_ID'),
  googleClientSecret: env('GOOGLE_CLIENT_SECRET'),
  // Prefer an explicit URI. Otherwise derive from WEB_URL when it is not a private LAN IP
  // (Google rejects 192.168/10/172.16 — Tailscale *.ts.net hostnames are allowed).
  googleRedirectUri:
    env('GOOGLE_REDIRECT_URI') ||
    (() => {
      const web = env('WEB_URL', 'http://localhost:8259');
      try {
        const host = new URL(web).hostname;
        const privateIp =
          /^10\./.test(host) ||
          /^192\.168\./.test(host) ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
        if (privateIp) return 'http://localhost:8259/cm-api/auth/callback/google';
        return `${new URL(web).origin}/cm-api/auth/callback/google`;
      } catch {
        return 'http://localhost:8259/cm-api/auth/callback/google';
      }
    })(),
  appEnv: env('APP_ENV', 'development'),
  s3Endpoint: env('S3_ENDPOINT', 'http://localhost:9000'),
  s3AccessKey: env('S3_ACCESS_KEY', 'minioadmin'),
  s3SecretKey: env('S3_SECRET_KEY', 'minioadmin'),
  s3Bucket: env('S3_BUCKET', 'clearmoney'),
  s3Region: env('S3_REGION', 'us-east-1'),
  stripeSecretKey: env('STRIPE_SECRET_KEY'),
  webOrigins: [
    env('WEB_URL', 'http://localhost:8259'),
    'http://localhost:8259',
    'http://127.0.0.1:8259',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // Tailscale MagicDNS — Better Auth supports wildcards in trustedOrigins.
    'http://*.ts.net:8259',
    'https://*.ts.net:8259',
    'http://*.ts.net',
    'https://*.ts.net',
    ...env('EXTRA_WEB_ORIGINS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ],
};
