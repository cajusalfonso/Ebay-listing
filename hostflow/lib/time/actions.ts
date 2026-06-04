"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import type { ActionState } from "@/lib/auth/actions";

const entrySchema = z
  .object({
    property_id: z.string().uuid("Bitte ein Objekt wählen"),
    task_id: z
      .union([z.string().uuid(), z.literal(""), z.literal("none")])
      .optional()
      .transform((v) => (v && v !== "none" ? v : null)),
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum ungültig"),
    mode: z.enum(["hours", "fixed"]),
    hours: z
      .union([z.coerce.number().positive(), z.literal(""), z.nan()])
      .optional(),
    fixed_amount: z
      .union([z.coerce.number().min(0), z.literal(""), z.nan()])
      .optional(),
  })
  .transform((v) => ({
    ...v,
    hours: typeof v.hours === "number" && !Number.isNaN(v.hours) ? v.hours : null,
    fixed_amount:
      typeof v.fixed_amount === "number" && !Number.isNaN(v.fixed_amount)
        ? v.fixed_amount
        : null,
  }));

/** Erfasst einen Zeit-/Kosteneintrag: entweder Stunden×Satz ODER Pauschale. */
export async function createTimeEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current) return { error: "Nicht angemeldet." };

  const parsed = entrySchema.safeParse({
    property_id: formData.get("property_id"),
    task_id: formData.get("task_id"),
    entry_date: formData.get("entry_date"),
    mode: formData.get("mode"),
    hours: formData.get("hours"),
    fixed_amount: formData.get("fixed_amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const data = parsed.data;
  let insert;

  if (data.mode === "hours") {
    if (!data.hours || data.hours <= 0) {
      return { error: "Bitte eine Stundenzahl größer 0 eingeben." };
    }
    const rate = current.profile.hourly_rate;
    if (rate == null) {
      return {
        error:
          "Für dich ist kein Stundensatz hinterlegt. Bitte den Inhaber den Satz setzen lassen oder eine Pauschale erfassen.",
      };
    }
    insert = {
      organization_id: current.organization.id,
      user_id: current.profile.id,
      property_id: data.property_id,
      task_id: data.task_id,
      entry_date: data.entry_date,
      hours: data.hours,
      fixed_amount: null,
      hourly_rate_snapshot: rate,
    };
  } else {
    if (data.fixed_amount == null || data.fixed_amount < 0) {
      return { error: "Bitte einen Pauschalbetrag eingeben." };
    }
    insert = {
      organization_id: current.organization.id,
      user_id: current.profile.id,
      property_id: data.property_id,
      task_id: data.task_id,
      entry_date: data.entry_date,
      hours: null,
      fixed_amount: data.fixed_amount,
      hourly_rate_snapshot: null,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert(insert);
  if (error) return { error: "Eintrag konnte nicht gespeichert werden." };

  revalidatePath("/zeiten");
  revalidatePath("/kosten");
  revalidatePath("/dashboard");
  return { message: "Zeit erfasst." };
}

export async function deleteTimeEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current) return { error: "Nicht angemeldet." };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Ungültige Anfrage." };

  const supabase = await createClient();
  // RLS erlaubt Löschen nur für eigene Einträge oder owner/manager.
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) return { error: "Eintrag konnte nicht gelöscht werden." };

  revalidatePath("/zeiten");
  revalidatePath("/kosten");
  revalidatePath("/dashboard");
  return { message: "Eintrag gelöscht." };
}
