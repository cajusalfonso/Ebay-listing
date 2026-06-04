"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/data/profile";
import { publicEnv } from "@/lib/env";
import { getStripe, hasStripe } from "@/lib/stripe/server";
import { planPriceId, setupFeePriceId } from "@/lib/stripe/plans";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/types";
import type { ActionState } from "@/lib/auth/actions";

function isPlan(v: unknown): v is Plan {
  return v === "s" || v === "m" || v === "l";
}

/** Stellt sicher, dass ein Stripe-Kunde existiert; legt ihn sonst an. */
async function ensureCustomer(orgId: string, orgName: string, email: string | null) {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", orgId)
    .single();

  if (org?.stripe_customer_id) return org.stripe_customer_id as string;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: orgName,
    metadata: { organization_id: orgId },
  });

  await admin
    .from("organizations")
    .update({ stripe_customer_id: customer.id })
    .eq("id", orgId);

  return customer.id;
}

/** Startet den Stripe-Checkout (Abo + ggf. einmalige Setup-Gebühr). */
export async function startCheckout(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current || current.profile.role !== "owner") {
    return { error: "Nur der Inhaber kann das Abo verwalten." };
  }
  if (!hasStripe() || !hasAdminClient()) {
    return { error: "Die Abrechnung ist noch nicht konfiguriert." };
  }

  const plan = formData.get("plan");
  if (!isPlan(plan)) return { error: "Ungültiger Tarif." };

  const priceId = planPriceId(plan);
  if (!priceId) return { error: "Dieser Tarif ist nicht konfiguriert." };

  let url: string | null = null;
  try {
    const customerId = await ensureCustomer(
      current.organization.id,
      current.organization.name,
      current.email,
    );

    const lineItems: { price: string; quantity: number }[] = [
      { price: priceId, quantity: 1 },
    ];

    // Einmalige Setup-Gebühr nur beim ersten Kauf (noch kein Plan gebucht).
    const setupFee = setupFeePriceId();
    if (current.organization.plan == null && setupFee) {
      lineItems.push({ price: setupFee, quantity: 1 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      allow_promotion_codes: true,
      success_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/abo?status=success`,
      cancel_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/abo?status=cancel`,
      metadata: { organization_id: current.organization.id, plan },
      subscription_data: {
        metadata: { organization_id: current.organization.id, plan },
      },
    });
    url = session.url;
  } catch {
    return { error: "Checkout konnte nicht gestartet werden." };
  }

  if (!url) return { error: "Checkout-URL fehlt." };
  redirect(url);
}

/** Öffnet das Stripe Customer Portal (Self-Service, Kündigung). */
export async function openPortal(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current || current.profile.role !== "owner") {
    return { error: "Nur der Inhaber kann das Abo verwalten." };
  }
  if (!hasStripe()) {
    return { error: "Die Abrechnung ist noch nicht konfiguriert." };
  }
  if (!current.organization.stripe_customer_id) {
    return { error: "Es besteht noch kein Abo." };
  }

  let url: string | null = null;
  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: current.organization.stripe_customer_id,
      return_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/abo`,
    });
    url = session.url;
  } catch {
    return { error: "Kundenportal konnte nicht geöffnet werden." };
  }

  redirect(url);
}
