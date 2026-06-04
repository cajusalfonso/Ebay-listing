import Link from "next/link";
import { ArrowRight, Building2, Users } from "lucide-react";

import { getCurrentUser } from "@/lib/data/profile";
import { isStaffRole } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard" };

function trialDaysLeft(trialEndsAt: string): number {
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) return null; // Layout kümmert sich um Redirects.

  const { profile, organization } = current;
  const firstName = profile.full_name.split(" ")[0] || "willkommen";
  const isStaff = isStaffRole(profile.role);
  const daysLeft = trialDaysLeft(organization.trial_ends_at);

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
            Testphase · noch {daysLeft} {daysLeft === 1 ? "Tag" : "Tage"}
          </Badge>
        )}
      </div>

      {/* Hinweis: Die Status-Ampel & Kennzahlen folgen in Phase 4. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {isStaff && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" /> Team verwalten
              </CardTitle>
              <CardDescription>
                Lade Reinigungskräfte und Hausmeister ein und lege Rollen &
                Stundensätze fest.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href="/team">
                  Zum Team <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" /> Objekte
            </CardTitle>
            <CardDescription>
              Lege deine Ferienwohnungen an und verbinde Kalender. (Phase 4)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" disabled>
              Bald verfügbar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
