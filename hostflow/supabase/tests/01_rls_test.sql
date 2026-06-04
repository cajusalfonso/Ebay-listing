-- ============================================================================
-- RLS-Tests — prüfen die Mandantentrennung und Rollenrechte.
-- Erwartet: Shim + Migrationen + Seed wurden zuvor eingespielt.
-- Fehlschlag → ASSERT bricht mit Fehlermeldung ab (Exit-Code != 0).
-- ============================================================================
\set ON_ERROR_STOP on

-- Hilfs-Claims der Seed-Nutzer
\set anna   '0a000000-0000-4000-8000-000000000001'
\set maria  '0a000000-0000-4000-8000-000000000002'
\set bob    '0b000000-0000-4000-8000-000000000001'

-- ----------------------------------------------------------------------------
-- 1) Anna (owner, Org A) sieht nur Org-A-Daten
-- ----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-4000-8000-000000000001","email":"anna@hostflow.test"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.properties;
  assert n = 2, format('owner A: erwartete 2 Objekte, sah %s', n);

  select count(*) into n from public.bookings;
  assert n = 2, format('owner A: erwartete 2 Buchungen, sah %s', n);

  select count(*) into n from public.tasks;
  assert n = 2, format('owner A: erwartete 2 Aufgaben, sah %s', n);

  select count(*) into n from public.profiles;
  assert n = 2, format('owner A: erwartete 2 Teamprofile, sah %s', n);

  select count(*) into n from public.expenses;
  assert n = 1, format('owner A: erwartete 1 Ausgabe, sah %s', n);

  select count(*) into n from public.time_entries;
  assert n = 2, format('owner A: erwartete 2 Zeiteinträge, sah %s', n);

  -- Kein Durchgriff auf Org B
  select count(*) into n from public.properties where organization_id = '22222222-2222-2222-2222-222222222222';
  assert n = 0, format('owner A: durfte 0 Org-B-Objekte sehen, sah %s', n);
end $$;
rollback;

-- ----------------------------------------------------------------------------
-- 2) Maria (cleaner, Org A) sieht nur Zugewiesenes + eigene Stunden
-- ----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-4000-8000-000000000002","email":"maria@hostflow.test"}', true);
do $$
declare n int;
begin
  -- nur die ihr zugewiesene Aufgabe
  select count(*) into n from public.tasks;
  assert n = 1, format('cleaner: erwartete 1 zugewiesene Aufgabe, sah %s', n);

  -- nur das Objekt mit zugewiesener Aufgabe
  select count(*) into n from public.properties;
  assert n = 1, format('cleaner: erwartete 1 Objekt, sah %s', n);

  -- nur das eigene Profil (keine Stundensätze der Kollegen)
  select count(*) into n from public.profiles;
  assert n = 1, format('cleaner: erwartete 1 Profil (sich selbst), sah %s', n);

  -- eigene Zeiteinträge
  select count(*) into n from public.time_entries;
  assert n = 2, format('cleaner: erwartete 2 eigene Zeiteinträge, sah %s', n);

  -- KEINE Kosten/Ausgaben
  select count(*) into n from public.expenses;
  assert n = 0, format('cleaner: durfte 0 Ausgaben sehen, sah %s', n);

  -- KEINE Buchungen/Gästedaten
  select count(*) into n from public.bookings;
  assert n = 0, format('cleaner: durfte 0 Buchungen sehen, sah %s', n);
end $$;
rollback;

-- ----------------------------------------------------------------------------
-- 3) Bob (owner, Org B) — strikte Trennung von Org A
-- ----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0b000000-0000-4000-8000-000000000001","email":"bob@hostflow.test"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.properties;
  assert n = 1, format('owner B: erwartete 1 Objekt, sah %s', n);

  select count(*) into n from public.tasks;
  assert n = 1, format('owner B: erwartete 1 Aufgabe, sah %s', n);

  select count(*) into n from public.profiles;
  assert n = 1, format('owner B: erwartete 1 Profil, sah %s', n);

  -- Kein Durchgriff auf Org A
  select count(*) into n from public.tasks where organization_id = '11111111-1111-1111-1111-111111111111';
  assert n = 0, format('owner B: durfte 0 Org-A-Aufgaben sehen, sah %s', n);
end $$;
rollback;

-- ----------------------------------------------------------------------------
-- 4) Cross-Tenant-WRITE wird blockiert: Bob darf nicht in Org A schreiben
-- ----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0b000000-0000-4000-8000-000000000001","email":"bob@hostflow.test"}', true);
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.tasks (organization_id, property_id, type, title)
    values ('11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'cleaning', 'Boese Aufgabe');
  exception when others then
    blocked := true;
  end;
  assert blocked, 'owner B konnte fremde Org-A-Aufgabe anlegen — RLS-Leck!';
end $$;
rollback;

-- ----------------------------------------------------------------------------
-- 5) cleaner darf keine fremde Aufgabe anlegen (kein is_staff)
-- ----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-4000-8000-000000000002","email":"maria@hostflow.test"}', true);
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.tasks (organization_id, property_id, type, title)
    values ('11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'cleaning', 'Selbst angelegt');
  exception when others then
    blocked := true;
  end;
  assert blocked, 'cleaner konnte Aufgabe anlegen — sollte blockiert sein';
end $$;
rollback;

-- ----------------------------------------------------------------------------
-- 6) RPC: accept_invitation verbindet einen neuen Nutzer mit der Org
-- ----------------------------------------------------------------------------
-- Vorbereitung (als Superuser/Server): neuen Auth-Nutzer + Einladung von Org A
begin;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '0c000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dora@hostflow.test', crypt('hostflow123', gen_salt('bf')), now(), now(), now());
insert into public.invitations (id, organization_id, email, role, hourly_rate, token, invited_by)
values ('e1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'dora@hostflow.test', 'maintenance', 18.00,
        'f1000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"0c000000-0000-4000-8000-000000000001","email":"dora@hostflow.test"}', true);
select public.accept_invitation('f1000000-0000-4000-8000-000000000001', 'Dora Wartung');
do $$
declare r public.user_role; org uuid;
begin
  select role, organization_id into r, org from public.profiles where id = '0c000000-0000-4000-8000-000000000001';
  assert org = '11111111-1111-1111-1111-111111111111', 'Einladung: falsche Organization verknüpft';
  assert r = 'maintenance', format('Einladung: erwartete Rolle maintenance, war %s', r);
end $$;
rollback;

-- Cleanup der Vorbereitungsdaten (als Superuser/Server)
delete from public.invitations where id = 'e1000000-0000-4000-8000-000000000001';
delete from public.profiles where id = '0c000000-0000-4000-8000-000000000001';
delete from auth.users where id = '0c000000-0000-4000-8000-000000000001';

\echo '============================================'
\echo '  ALLE RLS-TESTS BESTANDEN ✔'
\echo '============================================'
