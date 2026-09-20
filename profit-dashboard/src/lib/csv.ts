import Papa from "papaparse";

export type ParsedCsvRow = {
  date: string;
  amount: number;
  description: string;
  raw: Record<string, string>;
};

const DATE_HEADER_HINTS = ["datum", "date", "buchungstag", "wertstellung"];
const AMOUNT_HEADER_HINTS = [
  "betrag",
  "amount",
  "umsatz",
  "buchungsbetrag",
  "value",
];
const DESC_HEADER_HINTS = [
  "verwendungszweck",
  "buchungstext",
  "description",
  "beschreibung",
  "zweck",
  "text",
];

function findHeader(headers: string[], hints: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const hint of hints) {
    const idx = lower.findIndex((h) => h.includes(hint));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function parseGermanAmount(raw: string): number {
  const cleaned = raw
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseGermanDate(raw: string): string {
  const trimmed = raw.trim();
  // ISO already
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // dd.mm.yyyy
  const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return trimmed;
}

export function parseBankCsv(fileText: string): {
  rows: ParsedCsvRow[];
  detectedColumns: { date: string | null; amount: string | null; description: string | null };
} {
  const result = Papa.parse<Record<string, string>>(fileText, {
    header: true,
    skipEmptyLines: true,
    delimiter: "", // auto-detect
  });

  const headers = result.meta.fields ?? [];
  const dateCol = findHeader(headers, DATE_HEADER_HINTS);
  const amountCol = findHeader(headers, AMOUNT_HEADER_HINTS);
  const descCol = findHeader(headers, DESC_HEADER_HINTS);

  const rows: ParsedCsvRow[] = result.data
    .filter((r) => Object.values(r).some((v) => v && v.trim() !== ""))
    .map((r) => ({
      date: dateCol ? parseGermanDate(r[dateCol] ?? "") : "",
      amount: amountCol ? parseGermanAmount(r[amountCol] ?? "0") : 0,
      description: descCol ? (r[descCol] ?? "") : "",
      raw: r,
    }));

  return {
    rows,
    detectedColumns: { date: dateCol, amount: amountCol, description: descCol },
  };
}
