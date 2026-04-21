import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[migrate] DATABASE_URL is not set.');
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('[migrate] Migrations applied successfully.');
} catch (err) {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
