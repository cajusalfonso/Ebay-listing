/** Minimaler D1-Ersatz für Tests: speichert nur die Tabelle settings und error_log im Speicher. */
export function fakeD1(initialSettings?: unknown) {
  const settings = new Map<string, string>();
  if (initialSettings !== undefined) settings.set('app', JSON.stringify(initialSettings));
  const errors: unknown[][] = [];

  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async first<T>() {
          if (sql.includes('FROM settings')) {
            const v = settings.get(String(args[0]));
            return (v === undefined ? null : { value: v }) as T | null;
          }
          return null;
        },
        async run() {
          if (sql.includes('INTO error_log')) errors.push(args);
          if (sql.includes('INTO settings')) settings.set('app', String(args[0]));
          return { success: true };
        },
        async all() {
          return { results: [] };
        },
      };
      return stmt;
    },
  };
  return { db: db as unknown as D1Database, errors, settings };
}
