import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString = process.env.DATABASE_URL) {
  const url =
    connectionString || 'postgresql://clearmoney:clearmoney@localhost:5433/clearmoney';
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

export * from './schema/index.js';

