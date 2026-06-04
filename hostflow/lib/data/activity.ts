import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ActivityEntry {
  id: string;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
  actor: { full_name: string } | null;
}

/** Letzte Aktivitäten der Organisation (für owner/manager sichtbar). */
export async function getActivityFeed(limit = 20): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id, action, meta, created_at, actor:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as ActivityEntry[];
}

/** Baut aus action + meta eine deutsche Beschreibung der Aktivität. */
export function describeActivity(entry: ActivityEntry): string {
  const meta = entry.meta ?? {};
  const title = typeof meta.title === "string" ? meta.title : "";
  const name = typeof meta.name === "string" ? meta.name : "";
  const email = typeof meta.email === "string" ? meta.email : "";
  const statusLabel =
    typeof meta.status_label === "string" ? meta.status_label : "";

  switch (entry.action) {
    case "task.completed":
      return `hat „${title}" erledigt`;
    case "task.reopened":
      return `hat „${title}" wieder geöffnet`;
    case "task.status_changed":
      return `hat „${title}" auf ${statusLabel} gesetzt`;
    case "task.created":
      return `hat die Aufgabe „${title}" angelegt`;
    case "task.deleted":
      return "hat eine Aufgabe gelöscht";
    case "task.photo_added":
      return "hat ein Foto-Nachweis hochgeladen";
    case "property.created":
      return `hat das Objekt „${name}" angelegt`;
    case "property.deleted":
      return "hat ein Objekt gelöscht";
    case "invitation.created":
      return `hat ${email} eingeladen`;
    case "member.joined":
      return "ist dem Team beigetreten";
    case "organization.created":
      return "hat die Organisation erstellt";
    case "bookings.synced": {
      const created = typeof meta.created === "number" ? meta.created : 0;
      return `hat Buchungen synchronisiert (${created} neu)`;
    }
    default:
      return entry.action;
  }
}
