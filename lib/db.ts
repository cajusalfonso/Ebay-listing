import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';

type PgClient = ReturnType<typeof postgres>;
type DbClient = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  pg?: PgClient;
  db?: DbClient;
};

function initClients() {
  if (globalForDb.pg && globalForDb.db) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }
  globalForDb.pg = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  globalForDb.db = drizzle(globalForDb.pg, { schema });
}

// Lazy-init Proxies: connection + DATABASE_URL validation run on first access,
// not at module import time. This is what lets `next build` prerender pages
// without DATABASE_URL being present in the build environment.
export const pg = new Proxy({} as PgClient, {
  get(_, prop) {
    initClients();
    return Reflect.get(globalForDb.pg!, prop);
  },
  apply(_, thisArg, args) {
    initClients();
    return Reflect.apply(
      globalForDb.pg as unknown as (...a: unknown[]) => unknown,
      thisArg,
      args,
    );
  },
}) as PgClient;

export const db = new Proxy({} as DbClient, {
  get(_, prop) {
    initClients();
    return Reflect.get(globalForDb.db!, prop);
  },
}) as DbClient;
