"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ActionState = {
  error?: string;
  message?: string;
} | null;

const loginSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben"),
  password: z.string().min(1, "Bitte das Passwort eingeben"),
});

const registerSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben"),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen haben"),
  fullName: z.string().trim().min(1, "Bitte den Namen eingeben"),
  organizationName: z.string().trim().optional(),
  inviteToken: z.string().optional(),
});

function safeRedirectPath(path: FormDataEntryValue | null): string {
  const p = typeof path === "string" ? path : "";
  // Nur interne Pfade zulassen (kein Open Redirect).
  return p.startsWith("/") && !p.startsWith("//") ? p : "/dashboard";
}

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  redirect(safeRedirectPath(formData.get("redirect")));
}

export async function register(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    organizationName: formData.get("organizationName"),
    inviteToken: formData.get("inviteToken"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const { email, password, fullName, organizationName, inviteToken } =
    parsed.data;
  const isInvite = Boolean(inviteToken);

  if (!isInvite && !organizationName) {
    return { error: "Bitte den Namen der Organisation eingeben." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Metadaten überstehen die E-Mail-Bestätigung und steuern das Onboarding.
      data: {
        full_name: fullName,
        ...(organizationName ? { organization_name: organizationName } : {}),
        ...(inviteToken ? { invite_token: inviteToken } : {}),
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "Für diese E-Mail existiert bereits ein Konto." };
    }
    return { error: "Registrierung fehlgeschlagen. Bitte erneut versuchen." };
  }

  // Ohne aktive Session ist E-Mail-Bestätigung nötig.
  if (!data.session) {
    return {
      message:
        "Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir gesendet haben.",
    };
  }

  // Session aktiv → direkt weiter zum nächsten Schritt.
  redirect(isInvite ? `/einladung/${inviteToken}` : "/onboarding");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
