"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { isStaffRole, type UserRole } from "@/lib/types";
import type { ActionState } from "@/lib/auth/actions";

const ROLES = ["owner", "manager", "cleaner", "maintenance"] as const;

const inviteSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben"),
  role: z.enum(ROLES),
  hourlyRate: z
    .union([z.coerce.number().min(0), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
});

async function requireStaff() {
  const current = await getCurrentUser();
  if (!current || !isStaffRole(current.profile.role)) {
    return null;
  }
  return current;
}

/** Lädt ein neues Teammitglied per E-Mail ein (legt eine Einladung an). */
export async function inviteMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    hourlyRate: formData.get("hourlyRate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({
    organization_id: current.organization.id,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    hourly_rate: parsed.data.hourlyRate,
    invited_by: current.profile.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Für diese E-Mail gibt es bereits eine offene Einladung." };
    }
    return { error: "Einladung konnte nicht erstellt werden." };
  }

  await supabase.from("activity_log").insert({
    organization_id: current.organization.id,
    user_id: current.profile.id,
    action: "invitation.created",
    entity_type: "invitation",
    meta: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/team");
  return { message: "Einladung erstellt. Teile den Einladungslink." };
}

const updateSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(ROLES),
  hourlyRate: z
    .union([z.coerce.number().min(0), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
});

/** Aktualisiert Rolle und Stundensatz eines Teammitglieds. */
export async function updateMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };

  const parsed = updateSchema.safeParse({
    profileId: formData.get("profileId"),
    role: formData.get("role"),
    hourlyRate: formData.get("hourlyRate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  // Schutz vor Selbst-Aussperrung: eigene Rolle nicht über die Liste ändern.
  if (parsed.data.profileId === current.profile.id) {
    return { error: "Die eigene Rolle kann hier nicht geändert werden." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      role: parsed.data.role as UserRole,
      hourly_rate: parsed.data.hourlyRate,
    })
    .eq("id", parsed.data.profileId)
    .eq("organization_id", current.organization.id);

  if (error) return { error: "Änderung fehlgeschlagen." };

  revalidatePath("/team");
  return { message: "Teammitglied aktualisiert." };
}

/** Entfernt ein Teammitglied aus der Organisation. */
export async function removeMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };

  const profileId = formData.get("profileId");
  if (typeof profileId !== "string") return { error: "Ungültige Anfrage." };
  if (profileId === current.profile.id) {
    return { error: "Du kannst dich nicht selbst entfernen." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profileId)
    .eq("organization_id", current.organization.id);

  if (error) return { error: "Mitglied konnte nicht entfernt werden." };

  revalidatePath("/team");
  return { message: "Teammitglied entfernt." };
}

/** Zieht eine offene Einladung zurück. */
export async function revokeInvitation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };

  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string") return { error: "Ungültige Anfrage." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("organization_id", current.organization.id);

  if (error) return { error: "Einladung konnte nicht zurückgezogen werden." };

  revalidatePath("/team");
  return { message: "Einladung zurückgezogen." };
}
