import { test } from "node:test";
import assert from "node:assert/strict";

import { parseIcsEvents, detectSource } from "@/lib/ical/parse";
import {
  diffBooking,
  selectCancellations,
  shouldCreateCleaningTask,
  type ExistingBooking,
} from "@/lib/ical/reconcile";

const AIRBNB_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260615",
  "DTEND;VALUE=DATE:20260620",
  "UID:reservation-1@airbnb.com",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20260628",
  "DTEND;VALUE=DATE:20260701",
  "UID:block-1@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("parseIcsEvents: Reservierung und Block korrekt", () => {
  const events = parseIcsEvents(AIRBNB_ICS, {
    sourceHint: "https://www.airbnb.com/calendar/ical/x.ics",
  });
  assert.equal(events.length, 2);

  const reservation = events.find((e) => e.uid === "reservation-1@airbnb.com")!;
  assert.equal(reservation.checkIn, "2026-06-15");
  assert.equal(reservation.checkOut, "2026-06-20");
  assert.equal(reservation.isBlock, false);
  assert.equal(reservation.guestName, "Gast"); // generisch, keine Klarnamen
  assert.equal(reservation.source, "airbnb");

  const block = events.find((e) => e.uid === "block-1@airbnb.com")!;
  assert.equal(block.isBlock, true);
  assert.equal(block.guestName, null);
});

test("parseIcsEvents: idempotent (gleicher Input → gleiche UIDs)", () => {
  const a = parseIcsEvents(AIRBNB_ICS);
  const b = parseIcsEvents(AIRBNB_ICS);
  assert.deepEqual(
    a.map((e) => e.uid).sort(),
    b.map((e) => e.uid).sort(),
  );
});

test("detectSource: aus UID bzw. URL", () => {
  assert.equal(detectSource("abc@airbnb.com"), "airbnb");
  assert.equal(detectSource("xyz", "https://admin.booking.com/ical/123"), "booking");
});

test("diffBooking: unveränderte Buchung → null (Idempotenz)", () => {
  const existing: ExistingBooking = {
    id: "b1",
    external_uid: "reservation-1@airbnb.com",
    check_in: "2026-06-15",
    check_out: "2026-06-20",
    status: "confirmed",
    guest_name: "Gast",
    source: "airbnb",
  };
  const [event] = parseIcsEvents(AIRBNB_ICS);
  assert.equal(diffBooking(existing, event), null);
});

test("diffBooking: geänderter Check-out → Änderung", () => {
  const existing: ExistingBooking = {
    id: "b1",
    external_uid: "reservation-1@airbnb.com",
    check_in: "2026-06-15",
    check_out: "2026-06-19", // weicht ab
    status: "confirmed",
    guest_name: "Gast",
    source: "airbnb",
  };
  const [event] = parseIcsEvents(AIRBNB_ICS);
  const changes = diffBooking(existing, event);
  assert.ok(changes);
  assert.equal(changes!.check_out, "2026-06-20");
});

test("diffBooking: stornierte Buchung wieder im Feed → reaktivieren", () => {
  const existing: ExistingBooking = {
    id: "b1",
    external_uid: "reservation-1@airbnb.com",
    check_in: "2026-06-15",
    check_out: "2026-06-20",
    status: "cancelled",
    guest_name: "Gast",
    source: "airbnb",
  };
  const [event] = parseIcsEvents(AIRBNB_ICS);
  const changes = diffBooking(existing, event);
  assert.ok(changes);
  assert.equal(changes!.status, "confirmed");
});

test("selectCancellations: nur künftige, nicht-manuelle, fehlende Buchungen", () => {
  const today = "2026-06-04";
  const existing: ExistingBooking[] = [
    // Im Feed verschwunden, in der Zukunft → stornieren
    { id: "future", external_uid: "gone@airbnb.com", check_in: "2026-07-01", check_out: "2026-07-05", status: "confirmed", guest_name: "Gast", source: "airbnb" },
    // Vergangenheit → unangetastet
    { id: "past", external_uid: "old@airbnb.com", check_in: "2026-01-01", check_out: "2026-01-05", status: "confirmed", guest_name: "Gast", source: "airbnb" },
    // Manuell angelegt → nie automatisch stornieren
    { id: "manual", external_uid: null, check_in: "2026-08-01", check_out: "2026-08-05", status: "confirmed", guest_name: "Familie X", source: "manual" },
    // Noch im Feed → behalten
    { id: "kept", external_uid: "keep@airbnb.com", check_in: "2026-09-01", check_out: "2026-09-05", status: "confirmed", guest_name: "Gast", source: "airbnb" },
  ];
  const seen = new Set(["keep@airbnb.com"]);
  const cancelled = selectCancellations(existing, seen, today);
  assert.deepEqual(cancelled.map((b) => b.id), ["future"]);
});

test("shouldCreateCleaningTask: Reservierung künftig=true, Block/Vergangenheit=false", () => {
  const today = "2026-06-04";
  const [reservation, block] = parseIcsEvents(AIRBNB_ICS);
  assert.equal(shouldCreateCleaningTask(reservation, today), true);
  assert.equal(shouldCreateCleaningTask(block, today), false);
  // Vergangene Reservierung
  const past = { ...reservation, checkOut: "2026-05-01" };
  assert.equal(shouldCreateCleaningTask(past, today), false);
});
