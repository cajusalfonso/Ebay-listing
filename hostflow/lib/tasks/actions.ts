"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { isStaffRole } from "@/lib/types";
import { readOnlyError } from "@/lib/billing/access";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
} from "@/lib/tasks/constants";
import type { ActionState } from "@/lib/auth/actions";

const optionalAssignee = z
  .union([z.string().uuid(), z.literal(""), z.literal("unassigned")])
  .optional()
  .transform((v) => (v && v !== "unassigned" ? v : null));

const taskSchema = z.object({
  title: z.string().trim().min(1, "Bitte einen Titel eingeben"),
  type: z.enum(TASK_TYPES as [string, ...string[]]),
  property_id: z.string().uuid("Bitte ein Objekt wählen"),
  assigned_to: optionalAssignee,
  due_date: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

async function requireStaff() {
  const current = await getCurrentUser();
  if (!current || !isStaffRole(current.profile.role)) return null;
  return current;
}

function parseTask(formData: FormData) {
  return taskSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    property_id: formData.get("property_id"),
    assigned_to: formData.get("assigned_to"),
    due_date: formData.get("due_date"),
    description: formData.get("description"),
  });
}

export async function createTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };
  const ro = readOnlyError(current.organization);
  if (ro) return { error: ro };

  const parsed = parseTask(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...parsed.data, organization_id: current.organization.id })
    .select("id")
    .single();

  if (error) return { error: "Aufgabe konnte nicht angelegt werden." };

  await supabase.from("activity_log").insert({
    organization_id: current.organization.id,
    user_id: current.profile.id,
    action: "task.created",
    entity_type: "task",
    entity_id: data.id,
    meta: { title: parsed.data.title },
  });

  revalidatePath("/aufgaben");
  revalidatePath("/dashboard");
  return { message: "Aufgabe angelegt." };
}

export async function updateTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };

  const ro = readOnlyError(current.organization);
  if (ro) return { error: ro };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Ungültige Anfrage." };

  const parsed = parseTask(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Eingabe ungültig" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", current.organization.id);

  if (error) return { error: "Aufgabe konnte nicht gespeichert werden." };

  revalidatePath("/aufgaben");
  revalidatePath(`/aufgaben/${id}`);
  revalidatePath("/dashboard");
  return { message: "Aufgabe gespeichert." };
}

export async function deleteTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireStaff();
  if (!current) return { error: "Keine Berechtigung." };

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Ungültige Anfrage." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("organization_id", current.organization.id);

  if (error) return { error: "Aufgabe konnte nicht gelöscht werden." };

  await supabase.from("activity_log").insert({
    organization_id: current.organization.id,
    user_id: current.profile.id,
    action: "task.deleted",
    entity_type: "task",
    entity_id: id,
    meta: {},
  });

  revalidatePath("/aufgaben");
  revalidatePath("/dashboard");
  return { message: "Aufgabe gelöscht." };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TASK_STATUSES as [string, ...string[]]),
});

/** Statuswechsel (owner/manager oder zugewiesenes Mitglied). Schreibt activity_log. */
export async function setTaskStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current) return { error: "Nicht angemeldet." };
  const ro = readOnlyError(current.organization);
  if (ro) return { error: ro };

  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Ungültige Anfrage." };
  const nextStatus = parsed.data.status as import("@/lib/tasks/constants").TaskStatus;

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!task) return { error: "Aufgabe nicht gefunden." };

  const isDone = parsed.data.status === "done";
  const { error } = await supabase
    .from("tasks")
    .update({
      status: parsed.data.status,
      completed_at: isDone ? new Date().toISOString() : null,
      completed_by: isDone ? current.profile.id : null,
    })
    .eq("id", parsed.data.id);

  // RLS verhindert unbefugte Änderungen → freundliche Meldung.
  if (error) return { error: "Status konnte nicht geändert werden." };

  const action = isDone
    ? "task.completed"
    : task.status === "done"
      ? "task.reopened"
      : "task.status_changed";

  await supabase.from("activity_log").insert({
    organization_id: current.organization.id,
    user_id: current.profile.id,
    action,
    entity_type: "task",
    entity_id: parsed.data.id,
    meta: {
      title: task.title,
      status: nextStatus,
      status_label: TASK_STATUS_LABELS[nextStatus],
    },
  });

  revalidatePath("/aufgaben");
  revalidatePath(`/aufgaben/${parsed.data.id}`);
  revalidatePath("/dashboard");
  return { message: "Status aktualisiert." };
}

/** Speichert einen bereits hochgeladenen Foto-Nachweis (Storage-Pfad). */
export async function recordTaskPhoto(
  taskId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const current = await getCurrentUser();
  if (!current) return { error: "Nicht angemeldet." };
  const ro = readOnlyError(current.organization);
  if (ro) return { error: ro };

  const supabase = await createClient();
  const { error } = await supabase.from("task_photos").insert({
    task_id: taskId,
    organization_id: current.organization.id,
    storage_path: storagePath,
    uploaded_by: current.profile.id,
  });

  if (error) return { error: "Foto konnte nicht gespeichert werden." };

  await supabase.from("activity_log").insert({
    organization_id: current.organization.id,
    user_id: current.profile.id,
    action: "task.photo_added",
    entity_type: "task",
    entity_id: taskId,
    meta: {},
  });

  revalidatePath(`/aufgaben/${taskId}`);
  return {};
}

export async function deleteTaskPhoto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current) return { error: "Nicht angemeldet." };

  const photoId = formData.get("photoId");
  const storagePath = formData.get("storagePath");
  const taskId = formData.get("taskId");
  if (
    typeof photoId !== "string" ||
    typeof storagePath !== "string" ||
    typeof taskId !== "string"
  ) {
    return { error: "Ungültige Anfrage." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("task_photos").delete().eq("id", photoId);
  if (error) return { error: "Foto konnte nicht gelöscht werden." };

  // Datei aus dem Storage entfernen (Best Effort).
  await supabase.storage.from("task-photos").remove([storagePath]);

  revalidatePath(`/aufgaben/${taskId}`);
  return { message: "Foto gelöscht." };
}
