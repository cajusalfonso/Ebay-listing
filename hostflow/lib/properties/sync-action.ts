"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { isStaffRole } from "@/lib/types";
import { readOnlyError } from "@/lib/billing/access";
import { syncProperty } from "@/lib/ical/sync";
import type { ActionState } from "@/lib/auth/actions";

/** Manueller „Jetzt synchronisieren"-Button für ein Objekt. */
export async function syncPropertyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current || !isStaffRole(current.profile.role)) {
    return { error: "Keine Berechtigung." };
  }
  const ro = readOnlyError(current.organization);
  if (ro) return { error: ro };

  const propertyId = formData.get("propertyId");
  if (typeof propertyId !== "string") return { error: "Ungültige Anfrage." };

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, organization_id, name, ical_url")
    .eq("id", propertyId)
    .eq("organization_id", current.organization.id)
    .maybeSingle();

  if (!property) return { error: "Objekt nicht gefunden." };
  if (!property.ical_url) {
    return { error: "Für dieses Objekt ist kein iCal-Link hinterlegt." };
  }

  const result = await syncProperty(supabase, property);
  if (!result.ok) {
    return { error: result.error ?? "Synchronisierung fehlgeschlagen." };
  }

  revalidatePath("/objekte");
  revalidatePath("/dashboard");

  return {
    message: `Sync abgeschlossen: ${result.created} neu, ${result.updated} aktualisiert, ${result.cancelled} storniert, ${result.tasksCreated} Reinigungsaufgaben.`,
  };
}
