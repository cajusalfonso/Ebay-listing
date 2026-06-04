import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";

import { getCurrentUser } from "@/lib/data/profile";
import { hasStripe } from "@/lib/stripe/server";
import { PLANS, PLAN_ORDER } from "@/lib/stripe/plans";
import { Card, CardContent } from "@/components/ui/card";
import { BillingPanel } from "@/components/billing/billing-panel";

export const metadata = { title: "Abo" };

export default async function AboPage() {
  const current = await getCurrentUser();
  if (!current) return null;

  // Nur der Inhaber verwaltet Abo/Billing (manager: kein Zugriff).
  if (current.profile.role !== "owner") redirect("/dashboard");

  const stripeReady = hasStripe();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Abo & Abrechnung</h1>
        <p className="text-muted-foreground">
          Tarif nach Objektanzahl wählen und jederzeit kündbar verwalten.
        </p>
      </div>

      {!stripeReady ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CreditCard className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Die Abrechnung ist noch nicht aktiviert.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Sobald die Stripe-Schlüssel hinterlegt sind, kannst du hier einen
              Tarif buchen und dein Abo selbst verwalten. Bis dahin ist HostFlow
              uneingeschränkt nutzbar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <BillingPanel
          plans={PLAN_ORDER.map((id) => ({
            id,
            name: PLANS[id].name,
            priceHint: PLANS[id].priceHint,
            features: PLANS[id].features,
          }))}
          currentPlan={current.organization.plan}
          status={current.organization.subscription_status}
          hasCustomer={Boolean(current.organization.stripe_customer_id)}
          trialDaysLeft={Math.max(
            0,
            Math.ceil(
              (new Date(current.organization.trial_ends_at).getTime() -
                Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          )}
          isTrialing={current.organization.subscription_status === "trialing"}
        />
      )}
    </div>
  );
}
