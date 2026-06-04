// Status-Ampel für Objekte: abgeleitet aus Buchungen + offenen Reinigungsaufgaben.

export type PropertyStatus = "occupied" | "free" | "cleaning" | "blocked";

/** Minimal benötigte Buchungsfelder für die Statusberechnung. */
export interface StatusBooking {
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  status: "confirmed" | "cancelled";
  guest_name: string | null;
  source: "airbnb" | "booking" | "manual";
}

/** Minimal benötigte Aufgabenfelder für die Statusberechnung. */
export interface StatusTask {
  type: "cleaning" | "maintenance" | "checkin_prep" | "laundry" | "restock" | "other";
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
}

export const STATUS_META: Record<
  PropertyStatus,
  { label: string; dotClass: string; textClass: string; order: number }
> = {
  occupied: {
    label: "Vermietet",
    dotClass: "bg-status-occupied",
    textClass: "text-status-occupied",
    order: 1,
  },
  cleaning: {
    label: "In Reinigung",
    dotClass: "bg-status-cleaning",
    textClass: "text-status-cleaning",
    order: 2,
  },
  blocked: {
    label: "Blockiert",
    dotClass: "bg-status-blocked",
    textClass: "text-status-blocked",
    order: 3,
  },
  free: {
    label: "Frei",
    dotClass: "bg-status-free",
    textClass: "text-status-free",
    order: 4,
  },
};

/**
 * Leitet den heutigen Status eines Objekts ab.
 *
 * Priorität:
 *  1. Offene Reinigungsaufgabe (fällig heute oder überfällig) → "In Reinigung"
 *     (das ist die handlungsrelevante Information).
 *  2. Heute laufende Buchung (check_in ≤ heute < check_out):
 *     - ohne Gastname und nicht manuell → "Blockiert" (typischer iCal-Block)
 *     - sonst → "Vermietet"
 *  3. Andernfalls → "Frei".
 */
export function computePropertyStatus(
  bookings: StatusBooking[],
  tasks: StatusTask[],
  today: string,
): PropertyStatus {
  const hasOpenCleaning = tasks.some(
    (t) =>
      t.type === "cleaning" &&
      t.status !== "done" &&
      t.due_date != null &&
      t.due_date <= today,
  );
  if (hasOpenCleaning) return "cleaning";

  const activeBooking = bookings.find(
    (b) =>
      b.status === "confirmed" &&
      b.check_in <= today &&
      today < b.check_out,
  );
  if (activeBooking) {
    const isBlock = !activeBooking.guest_name && activeBooking.source !== "manual";
    return isBlock ? "blocked" : "occupied";
  }

  return "free";
}

/** Heutiges Datum als YYYY-MM-DD in der angegebenen Zeitzone. */
export function todayInTimeZone(timeZone = "Europe/Berlin"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
