import "server-only";

import Stripe from "stripe";

let cached: Stripe | null = null;

/** True, wenn Stripe konfiguriert ist (Secret-Key vorhanden). */
export function hasStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Lazy initialisierter Stripe-Client (nur serverseitig). */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY ist nicht konfiguriert.");
  }
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY, {
      appInfo: { name: "HostFlow" },
    });
  }
  return cached;
}
