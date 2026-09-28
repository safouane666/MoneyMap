import 'dotenv/config';
import { createDb } from '@clear-money/db';
import { pingDb, startPollLoop } from './jobs.js';
import { JOB_TYPES } from './types.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[worker] DATABASE_URL is required');
    process.exit(1);
  }

  const db = createDb(databaseUrl);
  await pingDb(db);

  console.log(
    `[worker] Clear Money worker listening for jobs: ${JOB_TYPES.join(', ')}`,
  );
  if (!process.env.AI_API_KEY) {
    console.warn(
      '[worker] AI_API_KEY missing — ai_monthly_report jobs will fail gracefully; core app stays up.',
    );
  }

  const controller = new AbortController();
  const loop = startPollLoop({
    db,
    intervalMs: Number(process.env.WORKER_POLL_MS ?? 2000),
    signal: controller.signal,
  });

  const shutdown = () => {
    console.log('[worker] shutting down');
    controller.abort();
    loop.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
