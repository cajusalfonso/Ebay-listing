import { NextResponse } from "next/server";

import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { syncProperty, type SyncResult } from "@/lib/ical/sync";

// Sync kann dauern → Standard-Edge-Caching deaktivieren, Node-Runtime nutzen.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron-Endpoint: synchronisiert alle Objekte mit hinterlegtem iCal-Link.
 * Schutz über Bearer-Token (CRON_SECRET). Nutzt den Service-Role-Client.
 *
 * Beispiel (Vercel Cron): GET /api/cron/sync mit Header
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET nicht konfiguriert" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  if (!hasAdminClient()) {
    return NextResponse.json(
      { error: "Service-Role-Key fehlt" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { data: properties, error } = await admin
    .from("properties")
    .select("id, organization_id, name, ical_url")
    .not("ical_url", "is", null);

  if (error) {
    return NextResponse.json({ error: "Objekte nicht ladbar" }, { status: 500 });
  }

  const results: SyncResult[] = [];
  for (const property of properties ?? []) {
    // Sequentiell, um externe Feeds nicht zu überlasten.
    results.push(await syncProperty(admin, property));
  }

  const summary = results.reduce(
    (acc, r) => ({
      created: acc.created + r.created,
      updated: acc.updated + r.updated,
      cancelled: acc.cancelled + r.cancelled,
      tasksCreated: acc.tasksCreated + r.tasksCreated,
    }),
    { created: 0, updated: 0, cancelled: 0, tasksCreated: 0 },
  );

  return NextResponse.json({
    synced: results.length,
    summary,
    results,
  });
}
