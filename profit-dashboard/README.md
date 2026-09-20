# Lumox Gewinn-Übersicht

Web-App zur Gewinn-Übersicht für **Lumox.store** (Elektronik/Samsung-Smartphones,
Shopify + Idealo/Geizhals/billiger.de/testsieger.de).

**Tech-Stack:** Next.js (App Router) · Supabase (Postgres + Auth) · Tailwind CSS ·
Recharts · Hosting über Vercel

## Funktionen

- **Login** (E-Mail/Passwort, Registrierung, Passwort-Reset) – jeder Nutzer sieht
  nur seine eigenen Daten (Supabase Row Level Security)
- **Bestellungen**: Erfassung mit automatischer Margen-Berechnung (€ und %),
  Retouren-Handling, rote Warnung unter einstellbarem Margen-Schwellwert,
  Auswertung nach Verkaufskanal und Lieferant, Excel-/PDF-Export
- **Kosten**: beliebige Kosten (einmalig/monatlich), automatische Hochrechnung auf gewählten
  Zeitraum
- **Kontoauszug**: CSV-Import aus dem Online-Banking mit automatischer
  Spalten-Erkennung (Datum/Betrag/Verwendungszweck), manuell korrigierbare
  Einnahme/Ausgabe-Zuordnung
- **Übersicht (Dashboard)**: Zeitraum-Auswahl, Gesamtumsatz/-kosten/-gewinn,
  automatische USt-Rücklagen-Anzeige (Satz einstellbar), Gewinn-Chart über die
  Monate, Umsatz/Gewinn pro Kanal, einfache Monats-Prognose, Excel-/PDF-Export
- **Einstellungen**: Margen-Schwellwert, USt-Satz, Standard-Kanalgebühren

## 1. Lokal zum Laufen bringen

Voraussetzung: Node.js ≥ 18.18 (empfohlen 20+).

```bash
cd profit-dashboard
npm install
cp .env.example .env.local
# .env.local mit den Werten aus Supabase befüllen (siehe Schritt 2)
npm run dev
```

App läuft danach unter `http://localhost:3000`. Ohne gültige Supabase-Werte in
`.env.local` startet die App zwar, Login/Datenbank funktionieren aber nicht.

Typecheck: `npm run typecheck` · Produktions-Build lokal testen: `npm run build`

## 2. Supabase einrichten

1. Kostenlosen Account auf [supabase.com](https://supabase.com) anlegen und ein
   neues Projekt erstellen (Region z.B. Frankfurt).
2. **Datenbank-Schema anlegen**: Im Supabase-Dashboard → *SQL Editor* → *New
   query* → Inhalt von [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   einfügen und ausführen. Das legt die Tabellen `orders`, `fixed_costs`,
   `bank_transactions`, `settings` inkl. Row-Level-Security an (jeder Nutzer
   sieht ausschließlich seine eigenen Zeilen).
3. **API-Keys holen**: Dashboard → *Project Settings* → *API*. Dort:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Beide in `.env.local` eintragen.
4. **E-Mail-Login aktivieren**: Ist bei neuen Supabase-Projekten standardmäßig
   an (Dashboard → *Authentication* → *Providers* → *Email*). Für den Start
   kann unter *Authentication* → *Providers* → *Email* die Option "Confirm
   email" ausgeschaltet werden, wenn du dich direkt nach der Registrierung
   einloggen möchtest, ohne die Bestätigungsmail abzuwarten.
5. **Redirect-URLs**: Dashboard → *Authentication* → *URL Configuration* →
   unter *Redirect URLs* sowohl `http://localhost:3000/auth/callback` (lokal)
   als auch später deine Vercel-Domain `https://DEINE-DOMAIN.vercel.app/auth/callback`
   eintragen. Das wird für den Passwort-Reset- und den E-Mail-Bestätigungs-Link
   benötigt.

Danach: registrieren unter `/register`, E-Mail bestätigen (falls aktiviert),
einloggen unter `/login`.

## 3. Live schalten über Vercel

1. Repository zu GitHub pushen (bereits erledigt, falls du dieses Projekt aus
   diesem Branch nutzt).
2. Auf [vercel.com](https://vercel.com) einloggen → *Add New* → *Project* →
   das Repository auswählen.
3. **Wichtig**: Da die App im Unterordner `profit-dashboard/` liegt, bei
   *Root Directory* auf "Edit" klicken und `profit-dashboard` auswählen.
4. Unter *Environment Variables* die beiden Werte aus `.env.local` eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. *Deploy* klicken. Nach dem ersten Deploy die Vercel-Domain in Supabase unter
   *Authentication* → *URL Configuration* als Redirect-URL ergänzen (siehe
   Schritt 2.5).

Von da an läuft die App unter der Vercel-URL, per Login von jedem Gerät
erreichbar (Handy, Laptop, …). Jeder Push auf den verbundenen Branch deployt
automatisch neu.

## Bekannte Einschränkungen / bewusste Vereinfachungen

- Wechselkurse werden manuell pro Bestellung eingetragen (kein automatischer
  Kurs-Abruf).
- Die Monats-Prognose im Dashboard ist eine einfache lineare Hochrechnung
  (bisheriger Gewinn im Monat ÷ vergangene Tage × Tage im Monat).
- Die Gewinn-Chart über die Monate basiert auf den Bestellungen; Kosten und
  Kontoauszug fließen nur in die aggregierten Gesamtkennzahlen (Übersicht-KPIs),
  nicht in den Monatsverlauf, ein.

## Ausbaustufe: Shopify-API-Anbindung (Vorschlag)

Aktuell werden Bestellungen manuell eingetragen. Als nächster Ausbauschritt
ließe sich das automatisieren:

- Shopify Admin API (REST oder GraphQL) mit einem Custom App Access Token
  anbinden.
- Ein Supabase Edge Function / Vercel Cron Job, der neue Bestellungen
  periodisch abruft und automatisch in die `orders`-Tabelle schreibt
  (Verkaufskanal fest auf "Shopify", Verkaufspreis/Produktname aus der
  Shopify-Order, Einkaufspreis/Lieferant müsste weiterhin manuell ergänzt
  werden, da Shopify diese Daten nicht kennt).
- Optional: Webhook `orders/create` statt Polling für Echtzeit-Import.

Das ist bewusst nicht Teil dieser ersten Version, lässt sich aber ohne
Architekturänderung ergänzen (die `orders`-Tabelle unterstützt das bereits).
