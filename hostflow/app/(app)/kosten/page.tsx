import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Clock, Euro } from "lucide-react";

import { getCurrentUser } from "@/lib/data/profile";
import { getPropertiesLite } from "@/lib/data/tasks";
import { currentMonth, getCostReport } from "@/lib/data/time";
import { entryCost } from "@/lib/time/cost";
import { isStaffRole } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { CostFilter } from "@/components/time/cost-filter";
import {
  MonthTrendChart,
  PropertyCostChart,
} from "@/components/charts/cost-charts";

export const metadata = { title: "Kosten" };

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export default async function KostenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; property?: string }>;
}) {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!isStaffRole(current.profile.role)) redirect("/dashboard");

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const propertyId = sp.property;

  const [report, properties] = await Promise.all([
    getCostReport(month, propertyId),
    getPropertiesLite(current.organization.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kosten</h1>
        <p className="text-muted-foreground">
          Personalkosten pro Objekt und Monat.
        </p>
      </div>

      <Suspense>
        <CostFilter
          month={month}
          propertyId={propertyId}
          properties={properties}
        />
      </Suspense>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          icon={Euro}
          label="Kosten im Monat"
          value={euro.format(report.total)}
        />
        <StatCard
          icon={Clock}
          label="Erfasste Stunden"
          value={`${report.totalHours.toLocaleString("de-DE")} Std.`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kosten pro Objekt</CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyCostChart
            data={report.perProperty.map((p) => ({
              name: p.name,
              cost: p.cost,
              color: p.color,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verlauf (6 Monate)</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthTrendChart data={report.perMonth} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Einzeleinträge</CardTitle>
        </CardHeader>
        <CardContent>
          {report.entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine Einträge in diesem Zeitraum.
            </p>
          ) : (
            <ul className="divide-y">
              {report.entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{e.property?.name ?? "—"}</span>
                    {e.user?.full_name && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {e.user.full_name}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {" "}
                      · {new Date(e.entry_date).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                  <span className="shrink-0 font-medium">
                    {euro.format(entryCost(e))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
