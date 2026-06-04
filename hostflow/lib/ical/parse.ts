import ical from "node-ical";

export type BookingSource = "airbnb" | "booking" | "manual";

export interface NormalizedEvent {
  /** Stabile, plattformseitige UID → idempotenter Abgleich. */
  uid: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  /** true = geblockter Zeitraum ohne Gast (z. B. „Not available"). */
  isBlock: boolean;
  /** Datensparsam: nur generische Kennzeichnung, keine Klarnamen. */
  guestName: string | null;
  source: BookingSource;
}

const BLOCK_PATTERN = /not available|unavailable|blocked|closed|geschlossen/i;

/** Date (UTC) → YYYY-MM-DD. iCal-Ganztagsdaten liegen als UTC-Mitternacht vor. */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Quelle aus UID-Domain bzw. Feed-URL ableiten. */
export function detectSource(uid: string, sourceHint?: string): BookingSource {
  const haystack = `${uid} ${sourceHint ?? ""}`.toLowerCase();
  if (haystack.includes("airbnb")) return "airbnb";
  if (haystack.includes("booking")) return "booking";
  return "airbnb"; // Häufigste Quelle; bei Unklarheit neutral als Reservierung behandeln.
}

/**
 * Parst einen ICS-Text in normalisierte Events. Reine Funktion ohne Netzwerk
 * → gut testbar. Ungültige/leere Events werden übersprungen.
 */
export function parseIcsEvents(
  icsText: string,
  opts: { sourceHint?: string } = {},
): NormalizedEvent[] {
  const parsed = ical.sync.parseICS(icsText);
  const events: NormalizedEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const comp = parsed[key];
    if (!comp || comp.type !== "VEVENT") continue;
    if (!comp.start || !comp.end) continue;

    const checkIn = toDateString(comp.start as Date);
    const checkOut = toDateString(comp.end as Date);
    if (checkOut < checkIn) continue;

    const summary = (comp.summary ?? "").toString().trim();
    const isBlock = BLOCK_PATTERN.test(summary);
    const uid = (comp.uid ?? key).toString();
    const source = detectSource(uid, opts.sourceHint);

    events.push({
      uid,
      checkIn,
      checkOut,
      isBlock,
      // Reservierungen erhalten ein generisches Label (für die Status-Ampel),
      // Blöcke bleiben ohne Gast. Es werden keine Klarnamen gespeichert.
      guestName: isBlock ? null : "Gast",
      source,
    });
  }

  return events;
}
