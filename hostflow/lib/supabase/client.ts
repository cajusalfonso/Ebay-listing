import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-Client für Client Components (läuft im Browser).
 * Nutzt den öffentlichen Anon-Key; RLS schützt die Daten.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
