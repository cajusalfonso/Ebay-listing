import { app } from './app';
import type { Env } from './env';
import { logError } from './log';

export default {
  fetch: app.fetch,

  /**
   * Läuft alle 5 Minuten (siehe wrangler.toml).
   * Die Jobs (Bestellungen, Schutzregeln, Nachtmodus, Erinnerungen)
   * kommen in Modul 4 und 5 dazu.
   */
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      // Platzhalter – noch keine Jobs aktiv.
    } catch (e) {
      await logError(env.DB, 'cron', e instanceof Error ? e.message : String(e));
    }
  },
} satisfies ExportedHandler<Env>;
