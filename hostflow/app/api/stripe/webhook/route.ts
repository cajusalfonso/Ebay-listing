import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe, hasStripe } from "@/lib/stripe/server";
import { planFromPriceId } from "@/lib/stripe/plans";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import type { Plan, SubscriptionStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe-Subscription-Status → internes Enum. */
function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "canceled";
  }
}

async function updateOrgByCustomer(
  customerId: string,
  patch: { subscription_status?: SubscriptionStatus; plan?: Plan | null },
) {
  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update(patch)
    .eq("stripe_customer_id", customerId);
}

export async function POST(request: Request) {
  if (!hasStripe() || !hasAdminClient()) {
    return NextResponse.json(
      { error: "Stripe nicht konfiguriert" },
      { status: 503 },
    );
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook-Secret fehlt" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signatur fehlt" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Signatur ungültig" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const priceId = sub.items.data[0]?.price.id ?? "";
        const plan = planFromPriceId(priceId);
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : mapStatus(sub.status);
        await updateOrgByCustomer(customerId, {
          subscription_status: status,
          plan,
        });
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const plan = (session.metadata?.plan as Plan | undefined) ?? null;
        if (customerId) {
          await updateOrgByCustomer(customerId, {
            subscription_status: "active",
            ...(plan ? { plan } : {}),
          });
        }
        break;
      }
      default:
        break;
    }
  } catch {
    // Fehler beim Verarbeiten → 500, damit Stripe erneut zustellt.
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
