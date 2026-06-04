import { z } from "zod";

/**
 * Zentrale, typsichere Validierung der Umgebungsvariablen.
 *
 * Server-Variablen werden nur serverseitig gelesen. Öffentliche Variablen
 * (NEXT_PUBLIC_*) sind auch im Browser verfügbar. In Phase 1 sind Stripe-
 * Variablen optional, damit die App ohne Live-Keys lokal startet.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL fehlt oder ist keine gültige URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PLAN_S: z.string().optional(),
  STRIPE_PRICE_PLAN_M: z.string().optional(),
  STRIPE_PRICE_PLAN_L: z.string().optional(),
  STRIPE_PRICE_SETUP_FEE: z.string().optional(),
});

/** Im Browser nutzbare, validierte Public-Env. */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

/**
 * Nur serverseitig aufrufen. Wirft, falls auf dem Client verwendet.
 */
export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() darf nur serverseitig aufgerufen werden");
  }
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PLAN_S: process.env.STRIPE_PRICE_PLAN_S,
    STRIPE_PRICE_PLAN_M: process.env.STRIPE_PRICE_PLAN_M,
    STRIPE_PRICE_PLAN_L: process.env.STRIPE_PRICE_PLAN_L,
    STRIPE_PRICE_SETUP_FEE: process.env.STRIPE_PRICE_SETUP_FEE,
  });
}
