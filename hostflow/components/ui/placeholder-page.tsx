import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Einfache Platzhalter-Seite. Wird in frühen Phasen für Routen genutzt,
 * deren Inhalt erst in einer späteren Phase gebaut wird.
 */
export function PlaceholderPage({
  title,
  phase,
  children,
}: {
  title: string;
  phase?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {children ?? (
        <p className="max-w-md text-muted-foreground">
          Dieser Bereich wird gerade aufgebaut
          {phase ? ` (${phase})` : ""}.
        </p>
      )}
      <Button asChild variant="outline" size="sm">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" /> Zur Startseite
        </Link>
      </Button>
    </main>
  );
}
