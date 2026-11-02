/** Fehler-Log in Klartext (Tabelle error_log), später im Dashboard sichtbar. */
export async function logError(
  db: D1Database,
  source: string,
  message: string,
  asin?: string | null,
): Promise<void> {
  try {
    await db
      .prepare('INSERT INTO error_log (at, level, source, message, asin) VALUES (datetime(\'now\'), ?, ?, ?, ?)')
      .bind('error', source, message.slice(0, 2000), asin ?? null)
      .run();
  } catch (e) {
    // Wenn selbst das Loggen scheitert, wenigstens in die Cloudflare-Logs schreiben.
    console.error('logError fehlgeschlagen', e, source, message);
  }
}
