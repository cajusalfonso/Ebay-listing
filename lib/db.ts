import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';

/**
 * Singleton DB client for the Next.js runtime. Next.js hot-reloads server
 * modules on edit — we cache the connection on `globalThis` so we don't leak
 * pool connections during dev.
 */
const globalForDb = globalThis as unknown as {
  pg?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set.');
}

export const pg =
  globalForDb.pg ??
  postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

export const db = globalForDb.db ?? drizzle(pg, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pg = pg;
  globalForDb.db = db;
}
