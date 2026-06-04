import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser, Organization, Profile } from "@/lib/types";

/**
 * Lädt den aktuell angemeldeten Nutzer inkl. Profil und Organization.
 * Gibt `null` zurück, wenn nicht angemeldet ODER noch kein Profil existiert
 * (Onboarding ausstehend). Pro Request gecached.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) return null;

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.organization_id)
    .maybeSingle<Organization>();

  if (!organization) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    organization,
  };
});

/**
 * Gibt zurück, ob der angemeldete Nutzer (falls vorhanden) bereits ein Profil
 * hat. Für das Onboarding-Routing genutzt.
 */
export async function getAuthState(): Promise<{
  isAuthenticated: boolean;
  hasProfile: boolean;
  userId: string | null;
  email: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isAuthenticated: false, hasProfile: false, userId: null, email: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    isAuthenticated: true,
    hasProfile: Boolean(profile),
    userId: user.id,
    email: user.email ?? null,
  };
}
