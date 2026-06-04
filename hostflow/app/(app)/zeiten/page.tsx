import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { getPropertiesLite } from "@/lib/data/tasks";
import { getMyTimeEntries } from "@/lib/data/time";
import { todayInTimeZone } from "@/lib/properties/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TimeEntryForm } from "@/components/time/time-entry-form";
import { TimeEntryList } from "@/components/time/time-entry-list";

export const metadata = { title: "Zeiten" };

export default async function ZeitenPage() {
  const current = await getCurrentUser();
  if (!current) return null;

  const supabase = await createClient();
  const [properties, entries, tasksRes] = await Promise.all([
    getPropertiesLite(current.organization.id),
    getMyTimeEntries(current.userId),
    supabase.from("tasks").select("id, title, property_id"),
  ]);

  const tasks = (tasksRes.data ?? []) as {
    id: string;
    title: string;
    property_id: string;
  }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Zeiten</h1>
        <p className="text-muted-foreground">
          Arbeitszeit oder Pauschalen pro Objekt erfassen.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          {properties.length > 0 ? (
            <TimeEntryForm
              properties={properties}
              tasks={tasks}
              defaultRate={current.profile.hourly_rate}
              today={todayInTimeZone()}
            />
          ) : (
            <Card>
              <CardContent className="space-y-3 py-8 text-center text-muted-foreground">
                <p>
                  Noch keine Objekte verfügbar, denen du Zeit zuordnen kannst.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/aufgaben">Zu den Aufgaben</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Meine Einträge
          </h2>
          <TimeEntryList entries={entries} />
        </div>
      </div>
    </div>
  );
}
