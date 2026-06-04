import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { isStaffRole } from "@/lib/types";
import { syncProperty } from "@/lib/ical/sync";

/**
 * Manueller Sync eines Objekts per API (z. B. aus dem Frontend oder Tooling).
 * Nutzt die Session des Aufrufers (RLS); nur owner/manager.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const current = await getCurrentUser();
  if (!current || !isStaffRole(current.profile.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, organization_id, name, ical_url")
    .eq("id", id)
    .eq("organization_id", current.organization.id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });
  }

  const result = await syncProperty(supabase, property);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
