"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/auth/actions";

const onboardSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Bitte den Namen der Organisation eingeben"),
  fullName: z.string().trim().optional(),
});

/** Legt die Organization an und macht den aktuellen Nutzer zum owner. */
export async function createOrganization(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = onboardSchema.safeParse({
    organizationName: formData.get("organizationName"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht angemeldet." };
  }

  const { error } = await supabase.rpc("onboard_owner", {
    org_name: parsed.data.organizationName,
    owner_name:
      parsed.data.fullName ||
      (user.user_metadata?.full_name as string | undefined) ||
      "",
  });

  if (error) {
    if (error.message.includes("Profil existiert bereits")) {
      redirect("/dashboard");
    }
    return { error: "Organisation konnte nicht angelegt werden." };
  }

  redirect("/dashboard");
}

/** Tritt einer Organization per Einladungs-Token bei. */
export async function acceptInvitation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) {
    return { error: "Ungültiger Einladungslink." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/einladung/${token}`);
  }

  const memberName =
    (formData.get("fullName") as string | null)?.trim() ||
    (user!.user_metadata?.full_name as string | undefined) ||
    "";

  const { error } = await supabase.rpc("accept_invitation", {
    invitation_token: token,
    member_name: memberName,
  });

  if (error) {
    if (error.message.includes("Profil existiert bereits")) {
      redirect("/dashboard");
    }
    return { error: bestEffortGermanError(error.message) };
  }

  redirect("/dashboard");
}

function bestEffortGermanError(message: string): string {
  if (message.includes("abgelaufen")) return "Diese Einladung ist abgelaufen.";
  if (message.includes("andere")) {
    return "Diese Einladung gehört zu einer anderen E-Mail-Adresse.";
  }
  if (message.includes("nicht mehr gültig")) {
    return "Diese Einladung ist nicht mehr gültig.";
  }
  if (message.includes("nicht gefunden")) {
    return "Einladung nicht gefunden.";
  }
  return "Einladung konnte nicht angenommen werden.";
}
