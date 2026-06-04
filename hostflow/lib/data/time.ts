import "server-only";

import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/properties/status";
import {
  entryCost,
  type CostReport,
  type PropertyCost,
  type TimeEntryRow,
} from "@/lib/time/cost";

export { entryCost };
export type { TimeEntryRow, PropertyCost, CostReport };

/** Eigene Zeiteinträge (neueste zuerst). */
export async function getMyTimeEntries(
  userId: string,
  limit = 50,
): Promise<TimeEntryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select(
      `id, entry_date, hours, fixed_amount, hourly_rate_snapshot,
       property:properties(name, color),
       task:tasks(title),
       user:profiles(full_name)`,
    )
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as TimeEntryRow[];
}

/** Erster Tag des Folgemonats (für exklusive Obergrenze). */
function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m, 1)); // m ist 1-basiert → ergibt Folgemonat
  return date.toISOString().slice(0, 10);
}

/** Aktueller Monat als YYYY-MM. */
export function currentMonth(): string {
  return todayInTimeZone().slice(0, 7);
}

/**
 * Kostenauswertung für owner/manager: Aggregation pro Objekt im gewählten
 * Monat plus 6-Monats-Trend. Optional auf ein Objekt gefiltert.
 */
export async function getCostReport(
  month: string,
  propertyId?: string,
): Promise<CostReport> {
  const supabase = await createClient();
  const start = `${month}-01`;
  const end = nextMonthStart(month);

  // Trend: 6 Monate zurück bis Ende des gewählten Monats.
  const [ty, tm] = month.split("-").map(Number);
  const trendStartDate = new Date(Date.UTC(ty, tm - 6, 1));
  const trendStart = trendStartDate.toISOString().slice(0, 10);

  let monthQuery = supabase
    .from("time_entries")
    .select(
      `id, entry_date, hours, fixed_amount, hourly_rate_snapshot, property_id,
       property:properties(name, color),
       task:tasks(title),
       user:profiles(full_name)`,
    )
    .gte("entry_date", start)
    .lt("entry_date", end);
  if (propertyId) monthQuery = monthQuery.eq("property_id", propertyId);

  const trendQuery = supabase
    .from("time_entries")
    .select("entry_date, hours, fixed_amount, hourly_rate_snapshot")
    .gte("entry_date", trendStart)
    .lt("entry_date", end);

  const [monthRes, trendRes] = await Promise.all([monthQuery, trendQuery]);

  const rows = (monthRes.data ?? []) as unknown as (TimeEntryRow & {
    property_id: string;
  })[];

  const byProperty = new Map<string, PropertyCost>();
  let total = 0;
  let totalHours = 0;
  const entries = rows.map((r) => {
    const cost = entryCost(r);
    total += cost;
    totalHours += Number(r.hours ?? 0);
    const key = r.property_id;
    const existing = byProperty.get(key);
    if (existing) {
      existing.cost += cost;
      existing.hours += Number(r.hours ?? 0);
    } else {
      byProperty.set(key, {
        id: key,
        name: r.property?.name ?? "—",
        color: r.property?.color ?? "#94a3b8",
        hours: Number(r.hours ?? 0),
        cost,
      });
    }
    return { ...r, cost };
  });

  // Trend pro Monat aufsummieren.
  const monthBuckets = new Map<string, number>();
  for (const r of (trendRes.data ?? []) as {
    entry_date: string;
    hours: number | null;
    fixed_amount: number | null;
    hourly_rate_snapshot: number | null;
  }[]) {
    const key = r.entry_date.slice(0, 7);
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + entryCost(r));
  }
  const perMonth: { month: string; cost: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    perMonth.push({ month: key, cost: monthBuckets.get(key) ?? 0 });
  }

  return {
    month,
    total,
    totalHours,
    perProperty: [...byProperty.values()].sort((a, b) => b.cost - a.cost),
    entries,
    perMonth,
  };
}
