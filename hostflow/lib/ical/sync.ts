import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseIcsEvents } from "@/lib/ical/parse";
import {
  diffBooking,
  selectCancellations,
  shouldCreateCleaningTask,
  type ExistingBooking,
} from "@/lib/ical/reconcile";
import { todayInTimeZone } from "@/lib/properties/status";

export interface SyncableProperty {
  id: string;
  organization_id: string;
  name: string;
  ical_url: string | null;
}

export interface SyncResult {
  property: string;
  ok: boolean;
  created: number;
  updated: number;
  cancelled: number;
  tasksCreated: number;
  error?: string;
}

interface InsertedBooking {
  id: string;
  check_out: string;
  external_uid: string | null;
}

const FETCH_TIMEOUT_MS = 10_000;

async function fetchIcs(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/calendar, text/plain, */*" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Synchronisiert eine Objekt-Belegung aus dem hinterlegten iCal-Feed.
 * Idempotent über (property_id, external_uid). Legt für neue/aktualisierte
 * Reservierungen automatisch eine Reinigungsaufgabe zum Check-out an.
 *
 * Der übergebene Client bestimmt die Rechte: RLS-Client (Button) oder
 * Service-Role (Cron).
 */
export async function syncProperty(
  client: SupabaseClient,
  property: SyncableProperty,
): Promise<SyncResult> {
  const result: SyncResult = {
    property: property.name,
    ok: false,
    created: 0,
    updated: 0,
    cancelled: 0,
    tasksCreated: 0,
  };

  if (!property.ical_url) {
    result.error = "Kein iCal-Link hinterlegt";
    return result;
  }

  let events;
  try {
    const ics = await fetchIcs(property.ical_url);
    events = parseIcsEvents(ics, { sourceHint: property.ical_url });
  } catch (e) {
    result.error =
      e instanceof Error ? `Feed nicht abrufbar (${e.message})` : "Feed-Fehler";
    return result;
  }

  const today = todayInTimeZone();

  // Bestehende, vom Feed stammende Buchungen laden.
  const { data: existingRows, error: loadErr } = await client
    .from("bookings")
    .select("id, external_uid, check_in, check_out, status, guest_name, source")
    .eq("property_id", property.id)
    .not("external_uid", "is", null);

  if (loadErr) {
    result.error = "Buchungen konnten nicht geladen werden";
    return result;
  }
  const existing = (existingRows ?? []) as ExistingBooking[];
  const byUid = new Map(existing.map((b) => [b.external_uid as string, b]));
  const seenUids = new Set<string>();

  // Neu anzulegende Buchungen sammeln.
  const toInsert = [];
  for (const ev of events) {
    seenUids.add(ev.uid);
    const match = byUid.get(ev.uid);
    if (match) {
      const changes = diffBooking(match, ev);
      if (changes) {
        const { error } = await client
          .from("bookings")
          .update(changes)
          .eq("id", match.id);
        if (!error) result.updated += 1;
      }
    } else {
      toInsert.push({
        organization_id: property.organization_id,
        property_id: property.id,
        external_uid: ev.uid,
        check_in: ev.checkIn,
        check_out: ev.checkOut,
        guest_name: ev.guestName,
        source: ev.source,
        status: "confirmed" as const,
      });
    }
  }

  let insertedBookings: InsertedBooking[] = [];
  if (toInsert.length > 0) {
    const { data, error } = await client
      .from("bookings")
      .insert(toInsert)
      .select("id, check_out, external_uid");
    if (!error && data) {
      insertedBookings = data as InsertedBooking[];
      result.created = insertedBookings.length;
    }
  }

  // Stornierungen: im Feed verschwundene, künftige Buchungen.
  const cancellations = selectCancellations(existing, seenUids, today);
  if (cancellations.length > 0) {
    const ids = cancellations.map((b) => b.id);
    const { error } = await client
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", ids);
    if (!error) {
      result.cancelled = ids.length;
      // Offene automatische Reinigungsaufgaben dieser Buchungen verwerfen.
      await client
        .from("tasks")
        .delete()
        .in("booking_id", ids)
        .eq("type", "cleaning")
        .eq("status", "todo");
    }
  }

  // Automatische Reinigungsaufgaben für Reservierungen ohne bestehende Aufgabe.
  result.tasksCreated = await ensureCleaningTasks(
    client,
    property,
    events,
    insertedBookings,
    byUid,
    today,
  );

  result.ok = true;

  await client.from("activity_log").insert({
    organization_id: property.organization_id,
    action: "bookings.synced",
    entity_type: "property",
    entity_id: property.id,
    meta: {
      created: result.created,
      updated: result.updated,
      cancelled: result.cancelled,
      tasks_created: result.tasksCreated,
    },
  });

  return result;
}

/**
 * Legt für Reservierungen (kein Block, Check-out ≥ heute) eine Reinigungsaufgabe
 * an, falls noch keine existiert. Die Eindeutigkeit ist zusätzlich per
 * partiellem Unique-Index in der DB abgesichert.
 */
async function ensureCleaningTasks(
  client: SupabaseClient,
  property: SyncableProperty,
  events: ReturnType<typeof parseIcsEvents>,
  insertedBookings: InsertedBooking[],
  byUid: Map<string, ExistingBooking>,
  today: string,
): Promise<number> {
  const eventByUid = new Map(events.map((e) => [e.uid, e]));
  const candidates = new Map<string, string>(); // booking_id → check_out

  // Neu eingefügte Buchungen: nur Reservierungen (kein Block) mit Zukunfts-Check-out.
  for (const ins of insertedBookings) {
    const ev = ins.external_uid ? eventByUid.get(ins.external_uid) : undefined;
    if (ev && shouldCreateCleaningTask(ev, today)) {
      candidates.set(ins.id, ins.check_out);
    }
  }
  // Bestehende Reservierungen, die evtl. noch keine Aufgabe haben.
  for (const ev of events) {
    if (!shouldCreateCleaningTask(ev, today)) continue;
    const match = byUid.get(ev.uid);
    if (match) candidates.set(match.id, match.check_out);
  }

  if (candidates.size === 0) return 0;

  const ids = [...candidates.keys()];
  const { data: existingTasks } = await client
    .from("tasks")
    .select("booking_id")
    .eq("type", "cleaning")
    .in("booking_id", ids);
  const withTask = new Set(
    (existingTasks ?? []).map((t: { booking_id: string }) => t.booking_id),
  );

  const newTasks = [...candidates.entries()]
    .filter(([id]) => !withTask.has(id))
    .map(([id, checkOut]) => ({
      organization_id: property.organization_id,
      property_id: property.id,
      booking_id: id,
      type: "cleaning" as const,
      title: `Reinigung – ${property.name}`,
      status: "todo" as const,
      due_date: checkOut,
    }));

  if (newTasks.length === 0) return 0;

  const { data, error } = await client.from("tasks").insert(newTasks).select("id");
  if (error || !data) return 0;
  return data.length;
}
