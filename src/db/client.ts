import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export type Schema = typeof schema;
export type Database = ReturnType<typeof drizzle<Schema>>;

export interface DbClient {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export interface DbClientOptions {
  /** Max connections in the pool. Default 10. */
  readonly maxConnections?: number;
  /** Idle timeout in seconds. Default 20. */
  readonly idleTimeoutSeconds?: number;
  /** Connection timeout in seconds. Default 10. */
  readonly connectTimeoutSeconds?: number;
  /** Passed to postgres-js; set to `true` to enable query logs. */
  readonly debug?: boolean;
}

/**
 * Factory — pure aside from connecting. Takes URL explicitly (no env lookup)
 * so tests and CLI commands can point it at different databases.
 *
 * Always call `close()` at the end of a script — postgres-js keeps the
 * event loop alive otherwise.
 */
export function createDbClient(url: string, options: DbClientOptions = {}): DbClient {
  const sql = postgres(url, {
    max: options.maxConnections ?? 10,
    idle_timeout: options.idleTimeoutSeconds ?? 20,
    connect_timeout: options.connectTimeoutSeconds ?? 10,
    debug: options.debug ?? false,
  });

  const db = drizzle(sql, { schema });

  return {
    db,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
