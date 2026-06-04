// Reine Kosten-Helfer & Typen (kein server-only) — auch im Client nutzbar.

export interface TimeEntryRow {
  id: string;
  entry_date: string;
  hours: number | null;
  fixed_amount: number | null;
  hourly_rate_snapshot: number | null;
  property: { name: string; color: string } | null;
  task: { title: string } | null;
  user: { full_name: string } | null;
}

export interface PropertyCost {
  id: string;
  name: string;
  color: string;
  hours: number;
  cost: number;
}

export interface CostReport {
  month: string;
  total: number;
  totalHours: number;
  perProperty: PropertyCost[];
  entries: (TimeEntryRow & { cost: number })[];
  perMonth: { month: string; cost: number }[];
}

/** Kosten eines Eintrags: Pauschale ODER Stunden×Satz. */
export function entryCost(e: {
  fixed_amount: number | null;
  hours: number | null;
  hourly_rate_snapshot: number | null;
}): number {
  if (e.fixed_amount != null) return Number(e.fixed_amount);
  return Number(e.hours ?? 0) * Number(e.hourly_rate_snapshot ?? 0);
}
