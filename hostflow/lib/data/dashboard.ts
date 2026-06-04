import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  computePropertyStatus,
  todayInTimeZone,
  type PropertyStatus,
  type StatusBooking,
  type StatusTask,
} from "@/lib/properties/status";

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface DashboardProperty {
  id: string;
  name: string;
  color: string;
  address: string | null;
  status: PropertyStatus;
}

export interface StaffDashboard {
  properties: DashboardProperty[];
  statusCounts: Record<PropertyStatus, number>;
  stats: {
    openTasksToday: number;
    upcomingCheckouts: number;
    monthlyStaffCost: number;
  };
}

/** Aggregierte Dashboard-Daten für owner/manager. */
export async function getStaffDashboard(
  organizationId: string,
): Promise<StaffDashboard> {
  const supabase = await createClient();
  const today = todayInTimeZone();
  const weekAhead = addDays(today, 7);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [propsRes, bookingsRes, tasksRes, timeRes] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, color, address")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true }),
    supabase
      .from("bookings")
      .select("property_id, check_in, check_out, status, guest_name, source")
      .eq("organization_id", organizationId)
      .gte("check_out", today),
    supabase
      .from("tasks")
      .select("property_id, type, status, due_date")
      .eq("organization_id", organizationId)
      .neq("status", "done")
      .lte("due_date", today),
    supabase
      .from("time_entries")
      .select("hours, fixed_amount, hourly_rate_snapshot, entry_date")
      .eq("organization_id", organizationId)
      .gte("entry_date", monthStart)
      .lte("entry_date", today),
  ]);

  const properties = propsRes.data ?? [];
  const bookings = (bookingsRes.data ?? []) as (StatusBooking & {
    property_id: string;
  })[];
  const tasks = (tasksRes.data ?? []) as (StatusTask & {
    property_id: string;
  })[];

  const statusCounts: Record<PropertyStatus, number> = {
    occupied: 0,
    cleaning: 0,
    blocked: 0,
    free: 0,
  };

  const dashboardProperties: DashboardProperty[] = properties.map((p) => {
    const status = computePropertyStatus(
      bookings.filter((b) => b.property_id === p.id),
      tasks.filter((t) => t.property_id === p.id),
      today,
    );
    statusCounts[status] += 1;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      address: p.address,
      status,
    };
  });

  const upcomingCheckouts = bookings.filter(
    (b) =>
      b.status === "confirmed" &&
      b.check_out >= today &&
      b.check_out <= weekAhead,
  ).length;

  const monthlyStaffCost = (timeRes.data ?? []).reduce((sum, e) => {
    const cost =
      e.fixed_amount != null
        ? Number(e.fixed_amount)
        : Number(e.hours ?? 0) * Number(e.hourly_rate_snapshot ?? 0);
    return sum + cost;
  }, 0);

  return {
    properties: dashboardProperties,
    statusCounts,
    stats: {
      openTasksToday: tasks.length,
      upcomingCheckouts,
      monthlyStaffCost,
    },
  };
}

export interface MyTask {
  id: string;
  title: string;
  type: string;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  property: { name: string; color: string } | null;
}

/** Persönliche, zugewiesene offene Aufgaben für cleaner/maintenance. */
export async function getMyOpenTasks(): Promise<MyTask[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("tasks")
    .select(
      "id, title, type, status, due_date, property:properties(name, color)",
    )
    .eq("assigned_to", user.id)
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false });

  return (data ?? []) as unknown as MyTask[];
}
