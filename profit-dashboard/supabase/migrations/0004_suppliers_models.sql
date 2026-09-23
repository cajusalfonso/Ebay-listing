-- Supplier & Modelle: Lieferanten-Stammdaten und Produkt-Varianten mit EK/VK.
-- Im Supabase SQL Editor ausfuehren, nachdem 0001-0003 bereits liefen.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_name text not null default '',
  contact_person text not null default '',
  email text not null default '',
  phone text not null default '',
  messenger text not null default '',
  country text not null default '',
  vat_id text not null default '',
  address text not null default '',
  platform text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists suppliers_user_id_idx on public.suppliers (user_id);

alter table public.suppliers enable row level security;

create policy "suppliers_select_own" on public.suppliers
  for select using (auth.uid() = user_id);
create policy "suppliers_insert_own" on public.suppliers
  for insert with check (auth.uid() = user_id);
create policy "suppliers_update_own" on public.suppliers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "suppliers_delete_own" on public.suppliers
  for delete using (auth.uid() = user_id);

create table if not exists public.product_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  model text not null default '',
  storage text not null default '',
  color text not null default '',
  purchase_price_net numeric not null default 0,
  sale_price_gross numeric not null default 0,
  purchase_date date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists product_models_user_id_idx on public.product_models (user_id);
create index if not exists product_models_supplier_id_idx on public.product_models (supplier_id);

alter table public.product_models enable row level security;

create policy "product_models_select_own" on public.product_models
  for select using (auth.uid() = user_id);
create policy "product_models_insert_own" on public.product_models
  for insert with check (auth.uid() = user_id);
create policy "product_models_update_own" on public.product_models
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "product_models_delete_own" on public.product_models
  for delete using (auth.uid() = user_id);

-- Standard-Zahlungsgebuehr (%) fuer "Marge nach Gebuehren" bei Modellen,
-- analog zur Zahlungsgebuehr die pro Bestellung erfasst wird.
alter table public.settings
  add column if not exists default_payment_fee_percent numeric not null default 2.4;
