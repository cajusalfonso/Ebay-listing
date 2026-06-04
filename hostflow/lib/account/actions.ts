"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { getStripe, hasStripe } from "@/lib/stripe/server";
import type { ActionState } from "@/lib/auth/actions";

/** Best-Effort-Löschung aller Foto-Dateien einer Organisation (2 Ebenen). */
async function purgeStorage(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
) {
  try {
    const { data: taskFolders } = await admin.storage
      .from("task-photos")
      .list(orgId);
    if (!taskFolders?.length) return;

    const paths: string[] = [];
    for (const folder of taskFolders) {
      const { data: files } = await admin.storage
        .from("task-photos")
        .list(`${orgId}/${folder.name}`);
      for (const file of files ?? []) {
        paths.push(`${orgId}/${folder.name}/${file.name}`);
      }
    }
    if (paths.length) await admin.storage.from("task-photos").remove(paths);
  } catch {
    // Best Effort — DB-Daten werden ohnehin entfernt.
  }
}

/** Storniert laufende Stripe-Abos der Organisation (Best Effort). */
async function cancelStripe(customerId: string) {
  try {
    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({ customer: customerId, limit: 100 });
    for (const sub of subs.data) {
      await stripe.subscriptions.cancel(sub.id);
    }
  } catch {
    // ignorieren
  }
}

/**
 * Löscht die Organisation samt aller Daten (DSGVO). Nur der Inhaber.
 * Bestätigung über exakte Eingabe des Organisationsnamens.
 */
export async function deleteAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current || current.profile.role !== "owner") {
    return { error: "Nur der Inhaber kann das Konto löschen." };
  }

  const confirm = formData.get("confirm");
  if (
    typeof confirm !== "string" ||
    confirm.trim() !== current.organization.name
  ) {
    return { error: "Bitte gib den Namen der Organisation exakt ein." };
  }

  const orgId = current.organization.id;

  if (hasAdminClient()) {
    const admin = createAdminClient();

    if (hasStripe() && current.organization.stripe_customer_id) {
      await cancelStripe(current.organization.stripe_customer_id);
    }

    // Mitglieder einsammeln, bevor die Profile per Cascade verschwinden.
    const { data: members } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId);

    await purgeStorage(admin, orgId);

    // Organisation löschen → kaskadiert alle abhängigen Tabellen.
    await admin.from("organizations").delete().eq("id", orgId);

    // Auth-Nutzer der Organisation entfernen.
    for (const member of members ?? []) {
      try {
        await admin.auth.admin.deleteUser(member.id);
      } catch {
        // ignorieren
      }
    }
  } else {
    // Ohne Service-Role: Org-Daten via RLS (owner) löschen.
    const supabase = await createClient();
    await supabase.from("organizations").delete().eq("id", orgId);
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect("/?deleted=1");
}
