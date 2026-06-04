import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/data/profile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";

export const metadata = { title: "Einstellungen" };

export default async function EinstellungenPage() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (current.profile.role !== "owner") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground">Organisation und Konto verwalten.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name:</span>{" "}
            <span className="font-medium">{current.organization.name}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Angemeldet als:</span>{" "}
            {current.email}
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Gefahrenzone</CardTitle>
          <CardDescription>
            Das Löschen des Kontos entfernt unwiderruflich alle Daten deiner
            Organisation und kündigt ein laufendes Abo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog organizationName={current.organization.name} />
        </CardContent>
      </Card>
    </div>
  );
}
