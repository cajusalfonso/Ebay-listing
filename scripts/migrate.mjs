import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'src', 'db', 'migrations');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[migrate] DATABASE_URL is not set.');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS __app_migrations (
      tag text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const journalRaw = await readFile(join(migrationsDir, 'meta', '_journal.json'), 'utf8');
  const journal = JSON.parse(journalRaw);

  const applied = await sql`SELECT tag FROM __app_migrations`;
  const appliedSet = new Set(applied.map((r) => r.tag));

  let appliedCount = 0;
  for (const entry of journal.entries) {
    if (appliedSet.has(entry.tag)) {
      console.log(`[migrate] Skipping already-applied: ${entry.tag}`);
      continue;
    }

    const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
    const content = await readFile(sqlPath, 'utf8');
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`[migrate] Applying ${entry.tag} (${statements.length} statement(s))...`);
    await sql.begin(async (tx) => {
      for (const stmt of statements) {
        await tx.unsafe(stmt);
      }
      await tx`INSERT INTO __app_migrations (tag) VALUES (${entry.tag})`;
    });
    appliedCount++;
  }

  console.log(
    appliedCount === 0
      ? '[migrate] Database is up-to-date. No migrations applied.'
      : `[migrate] Applied ${appliedCount} migration(s) successfully.`,
  );
}

try {
  await main();
} catch (err) {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
