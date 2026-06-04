"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { isStaffRole } from "@/lib/types";
import { readOnlyError } from "@/lib/billing/access";
import { maxPropertiesForPlan, PLANS } from "@/lib/stripe/plans";
import type { ActionState } from "@/lib/auth/actions";

const optionalNumber = z
  .union([z.coerce.number().min(0), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : Number(v)));

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const propertySchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben"),
  address: optionalText,
  ical_url: z
    .union([z.string().trim().url("Bitte eine gültige URL eingeben"), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  default_cleaning_fee: optionalNumber,
  notes: optionalText,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Ungültige Farbe")
    .optional()
    .transform((v) => v ?? "#2563eb"),
});

async function requireStaff() {
  const current = await getCurrentUser();
  if (!current || !isStaffRole(current.profile.role)) return null;
  return current;
}

function parseForm(formData: FormData) {
  return propertySchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    ical_url: formData.get("ical_url"),
    default_cleaning_fee: formData.get("default_cleaning_fee"),
    notes: formData.get("notes"),
    color: formData.get("color"),
  });
}

export async function createProperty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };
  const ro = readOnlyError(current.organization);
  if (ro) return { error: ro };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const supabase = await createClient();

  // Tarifgrenze prüfen (nur bei gebuchtem Plan).
  const limit = maxPropertiesForPlan(current.organization.plan);
  if (limit != null) {
    const { count } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", current.organization.id);
    if ((count ?? 0) >= limit) {
      const planName = current.organization.plan
        ? PLANS[current.organization.plan].name
        : "";
      return {
        error: `Tarifgrenze erreicht (${limit} Objekte im Tarif ${planName}). Bitte upgraden.`,
      };
    }
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({ ...parsed.data, organization_id: current.organization.id })
    .select("id")
    .single();

  if (error) return { error: "Objekt konnte nicht angelegt werden." };

  await supabase.from("activity_log").insert({
    organization_id: current.organization.id,
    user_id: current.profile.id,
    action: "property.created",
    entity_type: "property",
    entity_id: data.id,
    meta: { name: parsed.data.name },
  });

  revalidatePath("/objekte");
  revalidatePath("/dashboard");
  return { message: "Objekt angelegt." };
}

export async function updateProperty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };
  const ro = readOnlyError(current.organization);
  if (ro) return { error: ro };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Ungültige Anfrage." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", current.organization.id);

  if (error) return { error: "Objekt konnte nicht gespeichert werden." };

  revalidatePath("/objekte");
  revalidatePath("/dashboard");
  return { message: "Objekt gespeichert." };
}

export async function deleteProperty(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Ungültige Anfrage." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", id)
    .eq("organization_id", current.organization.id);

  if (error) return { error: "Objekt konnte nicht gelöscht werden." };

  await supabase.from("activity_log").insert({
    organization_id: current.organization.id,
    user_id: current.profile.id,
    action: "property.deleted",
    entity_type: "property",
    entity_id: id,
    meta: {},
  });

  revalidatePath("/objekte");
  revalidatePath("/dashboard");
  return { message: "Objekt gelöscht." };
}
