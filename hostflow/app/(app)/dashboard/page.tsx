import { CalendarClock, ClipboardList, Euro } from "lucide-react";

import { getCurrentUser } from "@/lib/data/profile";
import { getMyOpenTasks, getStaffDashboard } from "@/lib/data/dashboard";
import { isStaffRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  PropertyStatusGrid,
  StatusLegend,
} from "@/components/dashboard/property-status-grid";

export const metadata = { title: "Dashboard" };

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function trialDaysLeft(trialEndsAt: string): number {
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) return null;

  const { profile, organization } = current;
  const firstName = profile.full_name.split(" ")[0] || "willkommen";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hallo {firstName} 👋
          </h1>
          <p className="text-muted-foreground">{organization.name}</p>
        </div>
        {organization.subscription_status === "trialing" && (
          <Badge variant="secondary">
            Testphase · noch {trialDaysLeft(organization.trial_ends_at)} Tage
          </Badge>
        )}
      </div>

      {isStaffRole(profile.role) ? (
        <StaffDashboard organizationId={organization.id} />
      ) : (
        <CleanerDashboard />
      )}
    </div>
  );
}

async function StaffDashboard({ organizationId }: { organizationId: string }) {
  const { properties, statusCounts, stats } =
    await getStaffDashboard(organizationId);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={ClipboardList}
          label="Offene Aufgaben heute"
          value={stats.openTasksToday}
          hint="inkl. überfällig"
        />
        <StatCard
          icon={CalendarClock}
          label="Check-outs (7 Tage)"
          value={stats.upcomingCheckouts}
        />
        <StatCard
          icon={Euro}
          label="Personalkosten (Monat)"
          value={euro.format(stats.monthlyStaffCost)}
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Objekte</h2>
          <StatusLegend counts={statusCounts} />
        </div>
        <PropertyStatusGrid properties={properties} />
      </section>
    </>
  );
}

async function CleanerDashboard() {
  const tasks = await getMyOpenTasks();

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Meine offenen Aufgaben</h2>
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aktuell sind dir keine offenen Aufgaben zugewiesen. 🎉
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-3">
              <span
                className="h-8 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: t.property?.color ?? "#94a3b8" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {t.property?.name ?? "—"}
                </p>
              </div>
              {t.due_date && (
                <Badge variant="outline" className="shrink-0">
                  {new Date(t.due_date).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Aufgaben abhaken und Fotos hochladen kommt in Kürze.
      </p>
    </section>
  );
}
