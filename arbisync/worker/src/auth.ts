import type { MiddlewareHandler } from 'hono';
import { MIN_API_KEY_LENGTH, type Env } from './env';

/** Vergleich in konstanter Zeit, damit der Key nicht über Antwortzeiten erraten werden kann. */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Prüft den Header "X-API-Key" gegen API_KEY aus .env. */
export const requireApiKey: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const expected = c.env.API_KEY ?? '';
  if (expected.length < MIN_API_KEY_LENGTH) {
    return c.json(
      { error: `Server nicht eingerichtet: API_KEY fehlt oder ist kürzer als ${MIN_API_KEY_LENGTH} Zeichen.` },
      500,
    );
  }
  const given = c.req.header('X-API-Key') ?? '';
  if (!safeEqual(given, expected)) {
    return c.json({ error: 'Falscher oder fehlender API-Key.' }, 401);
  }
  return next();
};
