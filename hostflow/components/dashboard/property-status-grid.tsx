import Link from "next/link";
import { MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  type PropertyStatus,
} from "@/lib/properties/status";
import type { DashboardProperty } from "@/lib/data/dashboard";

const STATUS_ORDER: PropertyStatus[] = [
  "occupied",
  "cleaning",
  "blocked",
  "free",
];

export function StatusLegend({
  counts,
}: {
  counts: Record<PropertyStatus, number>;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {STATUS_ORDER.map((s) => (
        <span key={s} className="flex items-center gap-1.5 text-sm">
          <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[s].dotClass)} />
          <span className="text-muted-foreground">
            {STATUS_META[s].label}: {counts[s]}
          </span>
        </span>
      ))}
    </div>
  );
}

export function PropertyStatusGrid({
  properties,
}: {
  properties: DashboardProperty[];
}) {
  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">
            Noch keine Objekte angelegt.
          </p>
          <Button asChild size="sm">
            <Link href="/objekte">Objekt anlegen</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((p) => {
        const meta = STATUS_META[p.status];
        return (
          <Link key={p.id} href="/objekte" className="group">
            <Card className="overflow-hidden transition-colors group-hover:border-primary/50">
              <div className="h-1.5 w-full" style={{ backgroundColor: p.color }} />
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-semibold">{p.name}</h3>
                  <span
                    className={cn("h-3 w-3 shrink-0 rounded-full", meta.dotClass)}
                    aria-hidden
                  />
                </div>
                <p className={cn("text-sm font-medium", meta.textClass)}>
                  {meta.label}
                </p>
                {p.address && (
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" /> {p.address}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
