import type { NormalizedEvent } from "@/lib/ical/parse";

/** Buchung wie in der DB (für den Abgleich relevante Felder). */
export interface ExistingBooking {
  id: string;
  external_uid: string | null;
  check_in: string;
  check_out: string;
  status: "confirmed" | "cancelled";
  guest_name: string | null;
  source: "airbnb" | "booking" | "manual";
}

export interface BookingChanges {
  check_in?: string;
  check_out?: string;
  guest_name?: string | null;
  status?: "confirmed";
  source?: NormalizedEvent["source"];
}

/**
 * Vergleicht eine bestehende Buchung mit einem Event und liefert die zu
 * ändernden Felder (oder null, wenn unverändert). Macht den Sync idempotent.
 */
export function diffBooking(
  existing: ExistingBooking,
  event: NormalizedEvent,
): BookingChanges | null {
  const changes: BookingChanges = {};
  if (existing.check_in !== event.checkIn) changes.check_in = event.checkIn;
  if (existing.check_out !== event.checkOut) changes.check_out = event.checkOut;
  if (existing.guest_name !== event.guestName) changes.guest_name = event.guestName;
  if (existing.source !== event.source) changes.source = event.source;
  // War die Buchung zwischenzeitlich storniert, im Feed aber wieder da → reaktivieren.
  if (existing.status !== "confirmed") changes.status = "confirmed";

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Bestehende, vom Feed stammende Buchungen, die im aktuellen Feed fehlen und
 * noch in der Zukunft/heute liegen → wurden storniert. Vergangene bleiben
 * unangetastet (historische Daten).
 */
export function selectCancellations(
  existing: ExistingBooking[],
  seenUids: Set<string>,
  today: string,
): ExistingBooking[] {
  return existing.filter(
    (b) =>
      b.external_uid != null &&
      b.source !== "manual" &&
      b.status === "confirmed" &&
      !seenUids.has(b.external_uid) &&
      b.check_out >= today,
  );
}

/**
 * Soll für ein Event automatisch eine Reinigungsaufgabe entstehen?
 * Nur für Reservierungen (keine Blöcke) mit Check-out heute oder in der Zukunft.
 */
export function shouldCreateCleaningTask(
  event: NormalizedEvent,
  today: string,
): boolean {
  return !event.isBlock && event.checkOut >= today;
}
