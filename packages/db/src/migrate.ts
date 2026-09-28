import { config as loadEnv } from 'dotenv';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import postgres from 'postgres';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../../.env') });
loadEnv();

async function main() {
  const url = process.env.DATABASE_URL || 'postgresql://clearmoney:clearmoney@localhost:5433/clearmoney';
  const sql = postgres(url, { max: 1 });
  const dir = join(here, '../drizzle');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const body = readFileSync(join(dir, file), 'utf8');
    await sql.unsafe(body);
    console.log('Applied', file);
  }
  await sql.end();
  console.log('Migrations applied');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
