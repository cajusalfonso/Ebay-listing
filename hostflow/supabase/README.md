# Supabase — Schema, RLS & Seed (Phase 2)

Dieser Ordner enthält das komplette Datenbank-Setup von HostFlow als
versionierte Migrationen plus Seed-Daten und einen RLS-Testlauf.

```
supabase/
├─ migrations/
│  ├─ 20260604090000_init_schema.sql    # Enums, Tabellen, Indizes, Constraints
│  ├─ 20260604090100_rls_policies.sql   # Helper-Funktionen + alle RLS-Policies
│  ├─ 20260604090200_functions.sql      # onboard_owner(), accept_invitation()
│  └─ 20260604090300_storage.sql        # privater Bucket "task-photos" + Policies
├─ seed.sql                             # 2 Tenants + Beispieldaten zum Testen
└─ tests/
   ├─ 00_local_shim.sql                 # TEST-ONLY: emuliert auth/storage/Rollen
   ├─ 01_rls_test.sql                   # RLS-Assertions (Mandantentrennung)
   └─ run.sh                            # Testrunner gegen nacktes Postgres
```

## Auf ein echtes Supabase-Projekt anwenden

Voraussetzung: Supabase-Projekt in einer **EU-Region** (DSGVO) und die
[Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# Einmalig: lokales Projekt mit dem Remote verknüpfen
supabase link --project-ref <dein-project-ref>

# Migrationen anwenden
supabase db push

# (Optional) Seed-Daten einspielen — nur für Test-/Staging-Projekte!
psql "$DATABASE_URL" -f supabase/seed.sql
```

Alternativ lassen sich die vier Migrationsdateien in der angegebenen Reihenfolge
direkt im **SQL-Editor** des Supabase-Dashboards ausführen.

> Hinweis: `auth.users`, `auth.identities`, das `storage`-Schema und die Rollen
> `anon`/`authenticated`/`service_role` stellt Supabase selbst bereit. Der Shim
> unter `tests/` existiert nur, um die Migrationen lokal ohne Supabase-Stack
> testen zu können — er gehört **nicht** in die Produktion.

## RLS lokal testen (ohne Supabase-Stack)

Benötigt nur ein laufendes Postgres (≥ 14). Der Runner baut eine frische
Test-DB, spielt Shim → Migrationen → Seed ein und prüft die Mandantentrennung:

```bash
PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./supabase/tests/run.sh
```

Geprüft wird u. a.:

- owner/manager sehen nur Daten der eigenen Organization
- `cleaner`/`maintenance` sehen **nur** zugewiesene Aufgaben + **eigene** Stunden,
  **keine** Kosten/Buchungen/fremde Profile
- Cross-Tenant-Schreibzugriffe werden blockiert
- `accept_invitation()` verknüpft einen neuen Nutzer korrekt mit der Organization

## Test-Logins (Seed)

Passwort jeweils `hostflow123`:

| E-Mail               | Rolle   | Organization            |
| -------------------- | ------- | ----------------------- |
| anna@hostflow.test   | owner   | Strandhaus Verwaltung   |
| maria@hostflow.test  | cleaner | Strandhaus Verwaltung   |
| bob@hostflow.test    | owner   | City Apartments Berlin  |
