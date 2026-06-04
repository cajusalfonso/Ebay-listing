"use client";

import { useActionState, useEffect } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { openPortal, startCheckout } from "@/lib/billing/actions";
import type { ActionState } from "@/lib/auth/actions";
import type { Plan, SubscriptionStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubmitButton } from "@/components/forms/submit-button";

interface PlanView {
  id: Plan;
  name: string;
  priceHint: string;
  features: string[];
}

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Testphase",
  active: "Aktiv",
  past_due: "Zahlung offen",
  canceled: "Gekündigt",
};

export function BillingPanel({
  plans,
  currentPlan,
  status,
  hasCustomer,
  trialDaysLeft,
  isTrialing,
}: {
  plans: PlanView[];
  currentPlan: Plan | null;
  status: SubscriptionStatus;
  hasCustomer: boolean;
  trialDaysLeft: number;
  isTrialing: boolean;
}) {
  const [checkoutState, checkoutAction] = useActionState<ActionState, FormData>(
    startCheckout,
    null,
  );
  const [portalState, portalAction] = useActionState<ActionState, FormData>(
    openPortal,
    null,
  );

  useEffect(() => {
    if (checkoutState?.error) toast.error(checkoutState.error);
  }, [checkoutState]);
  useEffect(() => {
    if (portalState?.error) toast.error(portalState.error);
  }, [portalState]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-sm text-muted-foreground">Aktueller Status</p>
            <p className="text-lg font-semibold">
              {STATUS_LABEL[status]}
              {currentPlan && ` · Tarif ${planName(plans, currentPlan)}`}
            </p>
            {isTrialing && (
              <p className="text-sm text-muted-foreground">
                Noch {trialDaysLeft} {trialDaysLeft === 1 ? "Tag" : "Tage"} in der
                Testphase.
              </p>
            )}
          </div>
          {hasCustomer && (
            <form action={portalAction}>
              <SubmitButton variant="outline" pendingText="Öffne …">
                Abo verwalten
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && <Badge>Aktuell</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{plan.priceHint}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1.5 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-status-free" /> {f}
                    </li>
                  ))}
                </ul>
                <form action={checkoutAction}>
                  <input type="hidden" name="plan" value={plan.id} />
                  <SubmitButton
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    pendingText="Weiter zu Stripe …"
                  >
                    {isCurrent ? "Tarif wechseln" : `${plan.name} wählen`}
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Monatliches Abo, jederzeit über das Kundenportal kündbar. Beim ersten
        Kauf fällt eine einmalige Einrichtungsgebühr an.
      </p>
    </div>
  );
}

function planName(plans: PlanView[], id: Plan): string {
  return plans.find((p) => p.id === id)?.name ?? id.toUpperCase();
}
