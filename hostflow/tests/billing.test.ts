import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { getAccess } from "@/lib/billing/access";
import { planFromPriceId, planPriceId, maxPropertiesForPlan } from "@/lib/stripe/plans";

const future = new Date(Date.now() + 5 * 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

const origEnv = { ...process.env };
beforeEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
});
afterEach(() => {
  process.env = { ...origEnv };
});

test("getAccess: ohne Stripe nie schreibgeschützt", () => {
  const a = getAccess({
    subscription_status: "trialing",
    trial_ends_at: past,
    plan: null,
  });
  assert.equal(a.readOnly, false);
});

test("getAccess: mit Stripe + aktives Abo → schreibbar", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  const a = getAccess({
    subscription_status: "active",
    trial_ends_at: past,
    plan: "m",
  });
  assert.equal(a.readOnly, false);
});

test("getAccess: laufende Testphase → schreibbar", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  const a = getAccess({
    subscription_status: "trialing",
    trial_ends_at: future,
    plan: null,
  });
  assert.equal(a.readOnly, false);
  assert.ok(a.trialDaysLeft >= 4);
});

test("getAccess: abgelaufene Testphase → Nur-Lese", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  const a = getAccess({
    subscription_status: "trialing",
    trial_ends_at: past,
    plan: null,
  });
  assert.equal(a.readOnly, true);
  assert.equal(a.reason, "trial_expired");
});

test("getAccess: gekündigtes Abo → Nur-Lese", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  const a = getAccess({
    subscription_status: "canceled",
    trial_ends_at: past,
    plan: "s",
  });
  assert.equal(a.readOnly, true);
  assert.equal(a.reason, "subscription_inactive");
});

test("plans: Price-ID hin und zurück", () => {
  process.env.STRIPE_PRICE_PLAN_M = "price_m_123";
  assert.equal(planPriceId("m"), "price_m_123");
  assert.equal(planFromPriceId("price_m_123"), "m");
  assert.equal(planFromPriceId("price_unknown"), null);
});

test("plans: Objektgrenzen", () => {
  assert.equal(maxPropertiesForPlan("s"), 3);
  assert.equal(maxPropertiesForPlan("m"), 10);
  assert.equal(maxPropertiesForPlan("l"), null);
  assert.equal(maxPropertiesForPlan(null), null);
});
