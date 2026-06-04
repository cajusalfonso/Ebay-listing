import Link from "next/link";
import {
  CalendarSync,
  ClipboardCheck,
  Euro,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: CalendarSync,
    title: "iCal-Sync",
    text: "Airbnb- & Booking-Kalender importieren — Reinigungsaufgaben entstehen automatisch zum Check-out.",
  },
  {
    icon: ClipboardCheck,
    title: "Aufgaben & Foto-Nachweis",
    text: "Aufgaben zuweisen, am Handy abhaken und mit Foto belegen. Alles nachvollziehbar im Aktivitäts-Feed.",
  },
  {
    icon: Users,
    title: "Team & Stunden",
    text: "Reinigungskräfte und Hausmeister verwalten, Stundensätze hinterlegen, Zeiten erfassen.",
  },
  {
    icon: Euro,
    title: "Kostenüberblick",
    text: "Personalkosten und Ausgaben pro Objekt und Monat — einfach und auf einen Blick.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <span className="text-lg font-bold tracking-tight">HostFlow</span>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Anmelden</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Kostenlos testen</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="container flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Ferienwohnungen organisieren — ohne Chaos.
        </h1>
        <p className="max-w-xl text-balance text-lg text-muted-foreground">
          HostFlow bündelt Reinigung, Team und Kosten für kleine bis mittlere
          Vermieter. Einfach, schnell und fürs Handy gemacht.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">14 Tage kostenlos testen</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Ich habe schon ein Konto</Link>
          </Button>
        </div>

        <div className="mt-12 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="text-left">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{text}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-2 py-6 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} HostFlow</span>
          <nav className="flex gap-4">
            <Link href="/datenschutz" className="hover:text-foreground">
              Datenschutz
            </Link>
            <Link href="/impressum" className="hover:text-foreground">
              Impressum
            </Link>
            <Link href="/agb" className="hover:text-foreground">
              AGB
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
