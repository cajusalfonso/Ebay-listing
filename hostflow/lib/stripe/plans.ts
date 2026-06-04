import type { Plan } from "@/lib/types";

export interface PlanConfig {
  id: Plan;
  name: string;
  /** Maximale Objektanzahl; null = unbegrenzt. */
  maxProperties: number | null;
  priceEnv: string;
  priceHint: string;
  features: string[];
}

export const PLANS: Record<Plan, PlanConfig> = {
  s: {
    id: "s",
    name: "Starter",
    maxProperties: 3,
    priceEnv: "STRIPE_PRICE_PLAN_S",
    priceHint: "für bis zu 3 Objekte",
    features: ["Bis zu 3 Objekte", "Team & Aufgaben", "iCal-Sync", "Kostenüberblick"],
  },
  m: {
    id: "m",
    name: "Pro",
    maxProperties: 10,
    priceEnv: "STRIPE_PRICE_PLAN_M",
    priceHint: "für bis zu 10 Objekte",
    features: ["Bis zu 10 Objekte", "Alles aus Starter", "Priorisierter Support"],
  },
  l: {
    id: "l",
    name: "Unbegrenzt",
    maxProperties: null,
    priceEnv: "STRIPE_PRICE_PLAN_L",
    priceHint: "für unbegrenzt viele Objekte",
    features: ["Unbegrenzt Objekte", "Alles aus Pro"],
  },
};

export const PLAN_ORDER: Plan[] = ["s", "m", "l"];

/** Stripe-Price-ID eines Plans (oder null, wenn nicht konfiguriert). */
export function planPriceId(plan: Plan): string | null {
  return process.env[PLANS[plan].priceEnv] ?? null;
}

/** Stripe-Price-ID der einmaligen Setup-Gebühr. */
export function setupFeePriceId(): string | null {
  return process.env.STRIPE_PRICE_SETUP_FEE ?? null;
}

/** Plan aus einer Stripe-Price-ID zurückführen. */
export function planFromPriceId(priceId: string): Plan | null {
  for (const plan of PLAN_ORDER) {
    if (planPriceId(plan) === priceId) return plan;
  }
  return null;
}

/** Maximale Objektanzahl für einen (ggf. fehlenden) Plan. */
export function maxPropertiesForPlan(plan: Plan | null): number | null {
  if (!plan) return null;
  return PLANS[plan].maxProperties;
}
