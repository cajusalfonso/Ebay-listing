import "server-only";

import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/properties/status";
import type { TaskStatus, TaskType } from "@/lib/tasks/constants";

export interface TaskFilters {
  propertyId?: string;
  status?: TaskStatus;
  assignee?: string; // profile-id oder "unassigned"
  due?: "today" | "overdue" | "upcoming" | "all";
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  due_date: string | null;
  assigned_to: string | null;
  property: { id: string; name: string; color: string } | null;
  assignee: { full_name: string } | null;
  photo_count: { count: number }[];
}

/** Aufgabenliste mit Filtern. RLS begrenzt cleaner/maintenance auf Zugewiesenes. */
export async function getTasks(filters: TaskFilters): Promise<TaskRow[]> {
  const supabase = await createClient();
  const today = todayInTimeZone();

  let query = supabase
    .from("tasks")
    .select(
      `id, title, description, type, status, due_date, assigned_to,
       property:properties(id, name, color),
       assignee:profiles!tasks_assigned_to_fkey(full_name),
       photo_count:task_photos(count)`,
    );

  if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.assignee === "unassigned") {
    query = query.is("assigned_to", null);
  } else if (filters.assignee) {
    query = query.eq("assigned_to", filters.assignee);
  }

  switch (filters.due) {
    case "today":
      query = query.eq("due_date", today);
      break;
    case "overdue":
      query = query.lt("due_date", today).neq("status", "done");
      break;
    case "upcoming":
      query = query.gte("due_date", today);
      break;
    default:
      break;
  }

  const { data } = await query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as TaskRow[];
}

export interface TaskPhoto {
  id: string;
  storage_path: string;
  created_at: string;
  url: string | null;
}

export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  due_date: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  property: { id: string; name: string; color: string } | null;
  assignee: { full_name: string } | null;
  completer: { full_name: string } | null;
  photos: TaskPhoto[];
}

/** Einzelne Aufgabe inkl. Fotos (mit signierten URLs aus dem privaten Bucket). */
export async function getTask(id: string): Promise<TaskDetail | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tasks")
    .select(
      `id, title, description, type, status, due_date, assigned_to, completed_at,
       property:properties(id, name, color),
       assignee:profiles!tasks_assigned_to_fkey(full_name),
       completer:profiles!tasks_completed_by_fkey(full_name),
       photos:task_photos(id, storage_path, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const rawPhotos = (data.photos ?? []) as {
    id: string;
    storage_path: string;
    created_at: string;
  }[];

  // Signierte URLs für den privaten Bucket erzeugen (1 Stunde gültig).
  const photos: TaskPhoto[] = await Promise.all(
    rawPhotos
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(async (p) => {
        const { data: signed } = await supabase.storage
          .from("task-photos")
          .createSignedUrl(p.storage_path, 60 * 60);
        return { ...p, url: signed?.signedUrl ?? null };
      }),
  );

  return { ...(data as unknown as TaskDetail), photos };
}

export interface AssignableMember {
  id: string;
  full_name: string;
  role: string;
}

/** Teammitglieder zur Zuweisung (nur für owner/manager sinnvoll abrufbar). */
export async function getAssignableMembers(
  organizationId: string,
): Promise<AssignableMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });
  return (data ?? []) as AssignableMember[];
}

export interface PropertyLite {
  id: string;
  name: string;
  color: string;
}

/** Schlanke Objektliste für Filter/Formulare. */
export async function getPropertiesLite(
  organizationId: string,
): Promise<PropertyLite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, name, color")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });
  return (data ?? []) as PropertyLite[];
}
