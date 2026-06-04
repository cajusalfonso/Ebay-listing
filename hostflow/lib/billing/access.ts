import type { Organization } from "@/lib/types";

export const READ_ONLY_MESSAGE =
  "Deine Testphase ist abgelaufen. Bitte wähle einen Tarif, um HostFlow weiter zu nutzen.";

export interface Access {
  readOnly: boolean;
  reason: "ok" | "trial_expired" | "subscription_inactive";
  trialDaysLeft: number;
  isTrialing: boolean;
}

function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Ermittelt den Zugriffsstatus einer Organisation.
 * Schreibzugriff besteht bei aktivem Abo oder laufender Testphase.
 * Ohne konfiguriertes Stripe wird nicht eingeschränkt (Dev/Selfhost).
 */
export function getAccess(
  org: Pick<Organization, "subscription_status" | "trial_ends_at" | "plan">,
): Access {
  const trialEnd = new Date(org.trial_ends_at).getTime();
  const trialDaysLeft = Math.max(
    0,
    Math.ceil((trialEnd - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const isTrialing = org.subscription_status === "trialing";

  if (!stripeConfigured()) {
    return { readOnly: false, reason: "ok", trialDaysLeft, isTrialing };
  }

  if (org.subscription_status === "active") {
    return { readOnly: false, reason: "ok", trialDaysLeft, isTrialing: false };
  }

  if (isTrialing && trialEnd >= Date.now()) {
    return { readOnly: false, reason: "ok", trialDaysLeft, isTrialing: true };
  }

  return {
    readOnly: true,
    reason: isTrialing ? "trial_expired" : "subscription_inactive",
    trialDaysLeft,
    isTrialing,
  };
}

/** Liefert eine Fehlermeldung, falls die Organisation schreibgeschützt ist. */
export function readOnlyError(
  org: Pick<Organization, "subscription_status" | "trial_ends_at" | "plan">,
): string | null {
  return getAccess(org).readOnly ? READ_ONLY_MESSAGE : null;
}
