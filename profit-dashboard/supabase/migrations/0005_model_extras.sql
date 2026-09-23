-- Erweiterung "Supplier & Modelle": Spec (EU/US) + eigene Kategorien.
-- Im Supabase SQL Editor ausfuehren, nachdem 0001-0004 bereits liefen.
-- Bestehende Modelle bekommen automatisch spec = 'EU' (Default greift auch
-- rueckwirkend auf existierende Zeilen).

alter table public.product_models
  add column if not exists spec text not null default 'EU';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_models_spec_check'
  ) then
    alter table public.product_models
      add constraint product_models_spec_check check (spec in ('EU', 'US'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Eigene Kategorien (z.B. "Topseller", "Neuware diese Woche", "Nur B2B")
-- ---------------------------------------------------------------------
create table if not exists public.model_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists model_categories_user_id_idx on public.model_categories (user_id);

alter table public.model_categories enable row level security;

create policy "model_categories_select_own" on public.model_categories
  for select using (auth.uid() = user_id);
create policy "model_categories_insert_own" on public.model_categories
  for insert with check (auth.uid() = user_id);
create policy "model_categories_update_own" on public.model_categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "model_categories_delete_own" on public.model_categories
  for delete using (auth.uid() = user_id);

-- Zuordnung Modell <-> Kategorie (viele-zu-viele). Loeschen einer Kategorie
-- entfernt nur die Zuordnungen hier (on delete cascade), nicht die Modelle.
create table if not exists public.model_category_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_id uuid not null references public.product_models (id) on delete cascade,
  category_id uuid not null references public.model_categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (model_id, category_id)
);

create index if not exists model_category_links_user_id_idx on public.model_category_links (user_id);
create index if not exists model_category_links_model_id_idx on public.model_category_links (model_id);
create index if not exists model_category_links_category_id_idx on public.model_category_links (category_id);

alter table public.model_category_links enable row level security;

create policy "model_category_links_select_own" on public.model_category_links
  for select using (auth.uid() = user_id);
create policy "model_category_links_insert_own" on public.model_category_links
  for insert with check (auth.uid() = user_id);
create policy "model_category_links_delete_own" on public.model_category_links
  for delete using (auth.uid() = user_id);
