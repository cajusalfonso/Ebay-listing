# HostFlow

**Einfaches, deutschsprachiges Operations-Tool für Airbnb-/Ferienwohnungs-Vermieter.**

Für kleine bis mittlere Vermieter (2–20 Objekte), die Aufgaben, Team und Kosten
an einem Ort verwalten wollen — mobil-tauglich, weil Reinigungskräfte das Tool
am Handy nutzen.

> Hinweis: HostFlow liegt als eigenständige App im Ordner `hostflow/` und ist
> unabhängig vom eBay-Tool im Repo-Root.

---

## Tech-Stack

| Bereich      | Technologie                                            |
| ------------ | ------------------------------------------------------ |
| Frontend     | Next.js 15 (App Router) · TypeScript · Tailwind CSS    |
| UI           | shadcn/ui (Radix + CVA) · lucide-react                 |
| Backend/DB   | Supabase (Postgres, Auth, Storage, RLS) — **EU-Region**|
| Zahlungen    | Stripe (Abo + Setup-Gebühr + Customer Portal)          |
| Kalender     | node-ical (iCal-Import von Airbnb/Booking)             |
| Charts       | recharts                                               |
| Hosting      | Vercel (Frontend) + Supabase (Backend)                 |

UI-Texte sind auf **Deutsch**, Code/Variablen auf **Englisch**.

---

## Schnellstart (lokal)

```bash
cd hostflow

# 1. Dependencies
pnpm install        # oder: npm install

# 2. Env-Datei anlegen und ausfüllen
cp .env.example .env.local
#   → Supabase-Projekt (EU!) anlegen und URL + anon key eintragen
#   → Service-Role-Key eintragen (nur serverseitig genutzt)
#   → Stripe-Keys erst ab Phase 8 nötig

# 3. Dev-Server starten
pnpm dev
#   → http://localhost:3000
```

### Supabase-Projekt anlegen (DSGVO)

1. Auf [supabase.com](https://supabase.com) ein neues Projekt erstellen.
2. **Wichtig:** Als Region eine **EU-Region** wählen (z. B. Frankfurt) — DSGVO.
3. Unter _Project Settings → API_ findest du:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` Key → `SUPABASE_SERVICE_ROLE_KEY` (geheim!)

Das Datenbank-Schema und die RLS-Policies (Migrations) folgen in **Phase 2**.

---

## Skripte

| Befehl             | Zweck                                  |
| ------------------ | -------------------------------------- |
| `pnpm dev`         | Dev-Server (Hot Reload)                |
| `pnpm build`       | Produktions-Build                      |
| `pnpm start`       | Produktions-Server                     |
| `pnpm typecheck`   | TypeScript prüfen (keine Emits)        |
| `pnpm test`        | Unit-Tests (iCal-Parser & -Abgleich)   |
| `pnpm lint`        | ESLint                                 |
| `pnpm format`      | Prettier (schreibend)                  |

---

## Projektstruktur

```
hostflow/
├─ app/                  # Next.js App Router (Seiten, Layouts, Routen)
│  ├─ layout.tsx         # Root-Layout (de, Schrift, Metadaten)
│  ├─ page.tsx           # Landing-Page
│  ├─ globals.css        # Tailwind + Theme-Variablen (inkl. Status-Ampel)
│  ├─ login/ register/   # Auth-Platzhalter (Phase 3)
│  └─ datenschutz/ …     # DSGVO-Platzhalter (Phase 9)
├─ components/
│  └─ ui/                # shadcn/ui-Komponenten (Button, Card, …)
├─ lib/
│  ├─ env.ts             # Typsichere Env-Validierung (zod)
│  ├─ utils.ts           # cn()-Helper
│  └─ supabase/          # Browser-, Server- & Middleware-Clients
├─ middleware.ts         # Session-Refresh + Schutz privater Routen
├─ components.json       # shadcn/ui-Konfiguration
└─ .env.example          # Vorlage für Umgebungsvariablen
```

---

## Rollenmodell (Kurzüberblick)

Jeder Vermieter-Account ist eine eigene **Organization** (Tenant). Datentrennung
strikt pro Organization über **RLS**.

| Rolle         | Rechte                                                          |
| ------------- | -------------------------------------------------------------- |
| `owner`       | Vollzugriff inkl. Kosten, Team, Abo/Billing, Objekte           |
| `manager`     | wie owner, aber **kein** Billing/Abo                           |
| `cleaner`     | nur zugewiesene Aufgaben + eigene Stunden, abhaken & Fotos      |
| `maintenance` | wie cleaner, für Wartungsaufgaben                              |

---

## Roadmap (Phasen)

- [x] **Phase 1** — Projekt-Setup: Next.js + Tailwind + shadcn/ui + Supabase-Clients + Env-Struktur + README
- [x] **Phase 2** — DB-Schema + RLS-Policies (Migrations) + Seed-Daten
- [x] **Phase 3** — Auth + Onboarding + Organization + Team-Einladungen
- [x] **Phase 4** — Properties CRUD + Dashboard mit Status-Ampel
- [x] **Phase 5** — iCal-Sync + automatische Reinigungsaufgaben
- [x] **Phase 6** — Tasks (Zuweisung, Foto-Upload, Status, activity_log)
- [x] **Phase 7** — Time-Entries + Kostenauswertung
- [ ] **Phase 8** — Stripe (Abo + einmalig + Trial + Customer Portal + Webhooks)
- [ ] **Phase 9** — DSGVO-Seiten + Account-Löschung + Politur

### Changelog

- **Phase 1** — Projektgerüst steht: Next.js-App-Router-Setup mit Tailwind und
  shadcn/ui-Basis (Button, Card), typsicherer Env-Validierung, drei Supabase-
  Clients (Browser/Server/Middleware) inkl. Routen-Schutz, deutscher Landing-
  Page und Platzhalter-Routen für Auth- und DSGVO-Seiten.
- **Phase 2** — Komplettes Datenbank-Schema als Supabase-Migrationen
  (`supabase/migrations/`): alle Tabellen des Datenmodells, Enums, Constraints
  (u. a. „Stunden ODER Pauschale", idempotenter iCal-Sync via Unique-Index) und
  Indizes. RLS auf jeder Tabelle mit strikter Mandantentrennung; cleaner/
  maintenance sehen nur zugewiesene Aufgaben + eigene Stunden. RPCs für
  Onboarding (`onboard_owner`) und Team-Einladungen (`accept_invitation`),
  privater Storage-Bucket für Aufgaben-Fotos, Seed mit zwei Tenants und ein
  lokaler RLS-Testlauf (`supabase/tests/run.sh`, alle Tests grün). Details:
  [`supabase/README.md`](./supabase/README.md).
- **Phase 3** — Auth & Onboarding: Registrierung (E-Mail + Passwort) legt über
  die `onboard_owner`-RPC eine neue Organization an und macht den Nutzer zum
  owner; Login/Logout; E-Mail-Bestätigungs-Callback. Geschützter App-Bereich
  (`app/(app)`) mit mobil-tauglichem Header, Navigation und Nutzer-Menü.
  Team-Verwaltung (`/team`, nur owner/manager): Mitglieder mit Rolle &
  Stundensatz anlegen/bearbeiten/entfernen, E-Mail-Einladungen mit teilbarem
  Einladungslink, Annahme über `/einladung/[token]` (`accept_invitation`-RPC).
  Zahlreiche shadcn/ui-Komponenten ergänzt (Input, Label, Dialog, Select,
  Dropdown, Avatar, Badge, Toaster …). `onboard_owner` zusätzlich gegen echtes
  Postgres getestet.
- **Phase 4** — Objekte-Verwaltung (`/objekte`, owner/manager): Anlegen,
  Bearbeiten, Löschen von Ferienwohnungen inkl. Adresse, iCal-Link,
  Reinigungspauschale, Notizen und Farbe. Dashboard mit **Status-Ampel** je
  Objekt (Vermietet / Frei / In Reinigung / Blockiert), abgeleitet aus
  Buchungen + offenen Reinigungsaufgaben (`computePropertyStatus`), plus
  Kennzahlen (offene Aufgaben heute, Check-outs der nächsten 7 Tage,
  Personalkosten des laufenden Monats). Eigene cleaner/maintenance-Ansicht mit
  „Meine offenen Aufgaben". Status-Logik gegen echte Seed-Daten verifiziert.
- **Phase 5** — iCal-Sync (Kern-Feature): server-seitiger Import der
  Airbnb-/Booking-Kalender mit `node-ical`. Idempotenter Abgleich über
  (property_id, external_uid) — keine Duplikate; verschwundene künftige
  Buchungen werden storniert, geänderte aktualisiert. Für jede neue/aktive
  Reservierung (kein Block) entsteht automatisch eine Reinigungsaufgabe zum
  Check-out (DB-seitig per partiellem Unique-Index abgesichert). Manueller
  „Jetzt synchronisieren"-Button je Objekt + API-Route
  `POST /api/properties/[id]/sync`; Cron-Endpoint `GET /api/cron/sync`
  (Bearer-`CRON_SECRET`, Service-Role) für alle Objekte. Parser- und
  Abgleich-Logik mit 8 Unit-Tests (`pnpm test`) abgedeckt; DB-Idempotenz gegen
  echtes Postgres verifiziert.
- **Phase 6** — Aufgaben (`/aufgaben`): Liste mit Filtern (Objekt, Status,
  Zuständige:r, Fälligkeit), CRUD für owner/manager, Zuweisung an Teammitglieder.
  Statuswechsel per Klick (Offen → In Arbeit → Erledigt) setzt completed_at/
  completed_by; jede Statusänderung landet im `activity_log`. Detailseite mit
  **Foto-Upload als Nachweis** (Supabase Storage, privater Bucket, signierte
  URLs) und Galerie. cleaner/maintenance sehen/bearbeiten nur Zugewiesenes und
  können abhaken & Fotos hochladen. Aktivitäts-Feed („Wer hat was gemacht") auf
  der Team-Seite. Task- und Foto-RLS (nur zugewiesene Aufgaben beschreibbar)
  gegen echtes Postgres verifiziert.
- **Phase 7** — Zeiterfassung (`/zeiten`, alle Rollen): Stunden×Satz ODER
  Pauschale pro Objekt/Aufgabe; Stundensatz wird beim Erfassen als Snapshot
  gespeichert. Eigene Einträge mit Löschen. Kostenauswertung (`/kosten`,
  owner/manager): Monats-/Objektfilter, Summe & Stunden, Balkendiagramm „Kosten
  pro Objekt" und 6-Monats-Verlauf (recharts) plus Einzelposten. XOR-Constraint
  (Stunden ODER Pauschale) und Zeit-RLS (nur eigene Einträge) gegen echtes
  Postgres verifiziert.
