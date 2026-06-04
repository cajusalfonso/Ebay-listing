-- ============================================================================
-- HostFlow — Seed-Daten zum Testen
-- Zwei getrennte Organisationen (Tenants), um die Mandantentrennung (RLS) zu
-- prüfen. Wird von `supabase db reset` automatisch eingespielt.
--
-- Test-Logins (Passwort jeweils: hostflow123):
--   anna@hostflow.test   → owner   (Strandhaus Verwaltung)
--   maria@hostflow.test  → cleaner (Strandhaus Verwaltung)
--   bob@hostflow.test    → owner   (City Apartments Berlin)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auth-Nutzer (Supabase auth.users + auth.identities)
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '0a000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'anna@hostflow.test',
   crypt('hostflow123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Anna Vermieter"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0a000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'maria@hostflow.test',
   crypt('hostflow123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Maria Reinigung"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0b000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'bob@hostflow.test',
   crypt('hostflow123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bob Berlin"}', now(), now());

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  ('0a000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
   '{"sub":"0a000000-0000-4000-8000-000000000001","email":"anna@hostflow.test"}', 'email', now(), now(), now()),
  ('0a000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000002',
   '{"sub":"0a000000-0000-4000-8000-000000000002","email":"maria@hostflow.test"}', 'email', now(), now(), now()),
  ('0b000000-0000-4000-8000-000000000001', '0b000000-0000-4000-8000-000000000001',
   '{"sub":"0b000000-0000-4000-8000-000000000001","email":"bob@hostflow.test"}', 'email', now(), now(), now());

-- ----------------------------------------------------------------------------
-- Organisationen (Tenants)
-- ----------------------------------------------------------------------------
insert into public.organizations (id, name, subscription_status, plan, trial_ends_at)
values
  ('11111111-1111-1111-1111-111111111111', 'Strandhaus Verwaltung', 'trialing', null, now() + interval '14 days'),
  ('22222222-2222-2222-2222-222222222222', 'City Apartments Berlin', 'active', 'm', now() + interval '14 days');

-- ----------------------------------------------------------------------------
-- Profile (Teammitglieder)
-- ----------------------------------------------------------------------------
insert into public.profiles (id, organization_id, full_name, role, hourly_rate)
values
  ('0a000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Anna Vermieter', 'owner', null),
  ('0a000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Maria Reinigung', 'cleaner', 15.00),
  ('0b000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob Berlin', 'owner', null);

-- ----------------------------------------------------------------------------
-- Objekte (Org A: 2 Objekte, Org B: 1 Objekt)
-- ----------------------------------------------------------------------------
insert into public.properties (id, organization_id, name, address, default_cleaning_fee, color)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Strandhaus Nordsee', 'Deichweg 1, 25826 St. Peter-Ording', 80.00, '#0ea5e9'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'FeWo Deichblick', 'Strandallee 12, 25826 St. Peter-Ording', 60.00, '#22c55e'),
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'City Apartment Mitte', 'Torstraße 5, 10119 Berlin', 70.00, '#f59e0b');

-- ----------------------------------------------------------------------------
-- Buchungen
-- ----------------------------------------------------------------------------
insert into public.bookings (id, organization_id, property_id, guest_name, check_in, check_out, source, external_uid)
values
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'Familie Müller', current_date - 3, current_date, 'airbnb', 'airbnb-uid-0001'),
  ('c1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000002', null, current_date + 2, current_date + 6, 'booking', 'booking-uid-0002'),
  ('c1000000-0000-4000-8000-000000000003', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'J. Smith', current_date - 1, current_date + 1, 'airbnb', 'airbnb-uid-0003');

-- ----------------------------------------------------------------------------
-- Aufgaben (Org A: u. a. eine Maria zugewiesene Reinigung am Check-out)
-- ----------------------------------------------------------------------------
insert into public.tasks (id, organization_id, property_id, booking_id, type, title, status, assigned_to, due_date)
values
  ('d1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'cleaning', 'Reinigung Strandhaus nach Check-out', 'todo', '0a000000-0000-4000-8000-000000000002', current_date),
  ('d1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000002', null, 'restock', 'Verbrauchsmaterial auffüllen', 'todo', null, current_date + 1),
  ('d1000000-0000-4000-8000-000000000003', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 'cleaning', 'Reinigung City Apartment', 'todo', null, current_date + 1);

-- ----------------------------------------------------------------------------
-- Zeiteinträge (Maria: einmal Stunden, einmal Pauschale)
-- ----------------------------------------------------------------------------
insert into public.time_entries (organization_id, task_id, property_id, user_id, hours, fixed_amount, hourly_rate_snapshot, entry_date)
values
  ('11111111-1111-1111-1111-111111111111', 'd1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000002', 2.50, null, 15.00, current_date),
  ('11111111-1111-1111-1111-111111111111', null, 'a1000000-0000-4000-8000-000000000002', '0a000000-0000-4000-8000-000000000002', null, 60.00, null, current_date);

-- ----------------------------------------------------------------------------
-- Ausgaben
-- ----------------------------------------------------------------------------
insert into public.expenses (organization_id, property_id, category, amount, expense_date, note)
values
  ('11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'reinigungsmittel', 24.90, current_date - 5, 'Putzmittel Nachkauf'),
  ('22222222-2222-2222-2222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'wäsche', 45.00, current_date - 2, 'Wäscheservice');
