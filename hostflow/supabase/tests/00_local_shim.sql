-- ============================================================================
-- TEST-ONLY Shim — emuliert die Teile von Supabase (auth/storage/Rollen), die
-- unsere Migrationen voraussetzen, damit Schema + RLS in einem nackten Postgres
-- getestet werden können. NICHT in Produktion einspielen (Supabase liefert all
-- das selbst). Kein Bestandteil von supabase/migrations.
-- ============================================================================

-- Rollen wie bei Supabase
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

-- pgcrypto für crypt()/gen_salt() im Seed (bei Supabase im Schema extensions)
create extension if not exists pgcrypto;

-- Minimale auth.users / auth.identities (Spalten-Teilmenge wie bei Supabase)
create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key,
  aud                text,
  role               text,
  email              text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data  jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists auth.identities (
  provider_id     text,
  user_id         uuid references auth.users (id) on delete cascade,
  identity_data   jsonb,
  provider        text,
  last_sign_in_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  primary key (provider_id, provider)
);

-- auth.uid()/auth.email() lesen die JWT-Claims aus einer Session-Variable.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '');
$$;

-- Minimaler Storage-Layer
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role;

-- storage.foldername('a/b/c.jpg') -> {a,b}
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)];
$$;
