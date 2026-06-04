import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Admin-Client mit Service-Role-Key — umgeht RLS. NUR serverseitig nutzen
 * (z. B. Einladungen lesen, Account löschen, iCal-Sync, Stripe-Webhooks).
 * Niemals an den Client geben.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY oder NEXT_PUBLIC_SUPABASE_URL fehlt — Admin-Client nicht verfügbar.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** True, wenn der Service-Role-Key konfiguriert ist. */
export function hasAdminClient(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
