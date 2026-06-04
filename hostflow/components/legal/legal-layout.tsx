import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Gemeinsames Layout für die rechtlichen Seiten (öffentlich). */
export function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="font-bold tracking-tight">
            HostFlow
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" /> Zurück
            </Link>
          </Button>
        </div>
      </header>

      <div className="container max-w-2xl py-10">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">{title}</h1>

        <div className="mb-6 flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Dies ist eine <strong>Vorlage</strong> mit Platzhaltern. Vor dem
            produktiven Einsatz bitte rechtlich prüfen und an deine
            Gegebenheiten anpassen.
          </p>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-foreground [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-muted-foreground [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:text-muted-foreground">
          {children}
        </div>
      </div>
    </main>
  );
}
