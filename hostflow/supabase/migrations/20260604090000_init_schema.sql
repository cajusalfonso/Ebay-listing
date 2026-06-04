-- ============================================================================
-- HostFlow — Phase 2: Datenbank-Schema
-- Mandantenmodell: jede Organization ist ein Tenant. Strikte Trennung via RLS
-- (siehe Folge-Migration). Diese Migration legt nur Typen, Tabellen, Indizes
-- und Constraints an.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('owner', 'manager', 'cleaner', 'maintenance');

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- Abo-Plan nach Objektanzahl: s = bis 3, m = bis 10, l = unbegrenzt
create type public.plan as enum ('s', 'm', 'l');

create type public.booking_source as enum ('airbnb', 'booking', 'manual');

create type public.booking_status as enum ('confirmed', 'cancelled');

create type public.task_type as enum (
  'cleaning', 'maintenance', 'checkin_prep', 'laundry', 'restock', 'other'
);

create type public.task_status as enum ('todo', 'in_progress', 'done');

create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

-- ----------------------------------------------------------------------------
-- organizations — der Tenant
-- ----------------------------------------------------------------------------
create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) > 0),
  stripe_customer_id  text unique,
  subscription_status public.subscription_status not null default 'trialing',
  plan                public.plan,
  trial_ends_at       timestamptz not null default (now() + interval '14 days'),
  created_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- profiles — Nutzer (1:1 mit auth.users), gehört zu genau einer Organization
-- ----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name       text not null default '',
  role            public.user_role not null default 'cleaner',
  hourly_rate     numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  created_at      timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

-- ----------------------------------------------------------------------------
-- invitations — E-Mail-Einladungen ins Team (Onboarding, Phase 3)
-- ----------------------------------------------------------------------------
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null,
  role            public.user_role not null default 'cleaner',
  hourly_rate     numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  token           uuid not null default gen_random_uuid() unique,
  status          public.invitation_status not null default 'pending',
  invited_by      uuid references public.profiles (id) on delete set null,
  accepted_at     timestamptz,
  expires_at      timestamptz not null default (now() + interval '14 days'),
  created_at      timestamptz not null default now()
);

create index invitations_organization_id_idx on public.invitations (organization_id);
-- Pro Organization nur eine offene Einladung je E-Mail
create unique index invitations_org_email_pending_uidx
  on public.invitations (organization_id, lower(email))
  where status = 'pending';

-- ----------------------------------------------------------------------------
-- properties — Objekte (Ferienwohnungen)
-- ----------------------------------------------------------------------------
create table public.properties (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  name                 text not null check (length(trim(name)) > 0),
  address              text,
  ical_url             text,
  default_cleaning_fee numeric(10, 2) check (default_cleaning_fee is null or default_cleaning_fee >= 0),
  notes                text,
  color                text default '#2563eb',
  created_at           timestamptz not null default now()
);

create index properties_organization_id_idx on public.properties (organization_id);

-- ----------------------------------------------------------------------------
-- bookings — Belegungen (aus iCal-Import oder manuell)
-- ----------------------------------------------------------------------------
create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id     uuid not null references public.properties (id) on delete cascade,
  guest_name      text,
  check_in        date not null,
  check_out       date not null,
  source          public.booking_source not null default 'manual',
  external_uid    text,
  status          public.booking_status not null default 'confirmed',
  created_at      timestamptz not null default now(),
  constraint bookings_dates_chk check (check_out >= check_in)
);

create index bookings_organization_id_idx on public.bookings (organization_id);
create index bookings_property_id_idx on public.bookings (property_id);
create index bookings_check_out_idx on public.bookings (check_out);
-- Idempotenter Sync: keine Duplikate je Objekt + externer UID
create unique index bookings_property_external_uid_uidx
  on public.bookings (property_id, external_uid)
  where external_uid is not null;

-- ----------------------------------------------------------------------------
-- tasks — Aufgaben (Reinigung, Wartung, …)
-- ----------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id     uuid not null references public.properties (id) on delete cascade,
  booking_id      uuid references public.bookings (id) on delete set null,
  type            public.task_type not null default 'cleaning',
  title           text not null check (length(trim(title)) > 0),
  description     text,
  status          public.task_status not null default 'todo',
  assigned_to     uuid references public.profiles (id) on delete set null,
  due_date        date,
  completed_at    timestamptz,
  completed_by    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index tasks_organization_id_idx on public.tasks (organization_id);
create index tasks_property_id_idx on public.tasks (property_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_status_due_date_idx on public.tasks (status, due_date);
-- Verhindert doppelte automatische Reinigungsaufgaben je Buchung (Phase 5)
create unique index tasks_booking_cleaning_uidx
  on public.tasks (booking_id)
  where type = 'cleaning' and booking_id is not null;

-- ----------------------------------------------------------------------------
-- task_photos — Foto-Nachweis je Aufgabe (Supabase Storage)
-- ----------------------------------------------------------------------------
create table public.task_photos (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path    text not null,
  uploaded_by     uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index task_photos_task_id_idx on public.task_photos (task_id);
create index task_photos_organization_id_idx on public.task_photos (organization_id);

-- ----------------------------------------------------------------------------
-- time_entries — Zeiterfassung: entweder hours×rate ODER fixed_amount
-- ----------------------------------------------------------------------------
create table public.time_entries (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  task_id              uuid references public.tasks (id) on delete set null,
  property_id          uuid not null references public.properties (id) on delete cascade,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  hours                numeric(6, 2) check (hours is null or hours > 0),
  fixed_amount         numeric(10, 2) check (fixed_amount is null or fixed_amount >= 0),
  hourly_rate_snapshot numeric(10, 2) check (hourly_rate_snapshot is null or hourly_rate_snapshot >= 0),
  entry_date           date not null default current_date,
  created_at           timestamptz not null default now(),
  -- entweder Stunden ODER Pauschale, nicht beides, nicht keines
  constraint time_entries_amount_chk check (
    (hours is not null and fixed_amount is null)
    or (hours is null and fixed_amount is not null)
  )
);

create index time_entries_organization_id_idx on public.time_entries (organization_id);
create index time_entries_user_id_idx on public.time_entries (user_id);
create index time_entries_property_id_idx on public.time_entries (property_id);
create index time_entries_entry_date_idx on public.time_entries (entry_date);

-- ----------------------------------------------------------------------------
-- expenses — sonstige Ausgaben
-- ----------------------------------------------------------------------------
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id     uuid references public.properties (id) on delete set null,
  category        text not null default 'sonstiges',
  amount          numeric(10, 2) not null check (amount >= 0),
  expense_date    date not null default current_date,
  note            text,
  created_at      timestamptz not null default now()
);

create index expenses_organization_id_idx on public.expenses (organization_id);
create index expenses_property_id_idx on public.expenses (property_id);
create index expenses_expense_date_idx on public.expenses (expense_date);

-- ----------------------------------------------------------------------------
-- activity_log — Aktivitäts-Feed ("Wer hat was gemacht")
-- ----------------------------------------------------------------------------
create table public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete set null,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index activity_log_organization_id_idx on public.activity_log (organization_id);
create index activity_log_created_at_idx on public.activity_log (created_at desc);
