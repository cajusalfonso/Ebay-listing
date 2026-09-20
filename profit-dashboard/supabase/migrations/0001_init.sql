-- Lumox Gewinn-Uebersicht: initiales Schema
-- Im Supabase SQL Editor ausfuehren (siehe README).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- settings: ein Datensatz pro Nutzer
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  margin_threshold_percent numeric not null default 10,
  vat_rate_percent numeric not null default 19,
  channel_fee_defaults jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_delete_own" on public.settings
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- orders: Bestellungen
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_date date not null default current_date,
  product_name text not null default '',
  sales_channel text not null default 'Shopify',
  supplier text not null default '',
  sale_price numeric not null default 0,
  purchase_price numeric not null default 0,
  purchase_currency text not null default 'EUR',
  exchange_rate numeric not null default 1,
  shipping_cost numeric not null default 0,
  payment_fee_percent numeric not null default 0,
  channel_fee_percent numeric not null default 0,
  other_costs numeric not null default 0,
  status text not null default 'bestellt',
  is_return boolean not null default false,
  return_cost numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_order_date_idx on public.orders (order_date);

alter table public.orders enable row level security;

create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);
create policy "orders_update_own" on public.orders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "orders_delete_own" on public.orders
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- fixed_costs: Fixkosten
-- ---------------------------------------------------------------------
create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default '',
  category text not null default 'Sonstiges',
  amount numeric not null default 0,
  rhythm text not null default 'monatlich',
  start_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists fixed_costs_user_id_idx on public.fixed_costs (user_id);

alter table public.fixed_costs enable row level security;

create policy "fixed_costs_select_own" on public.fixed_costs
  for select using (auth.uid() = user_id);
create policy "fixed_costs_insert_own" on public.fixed_costs
  for insert with check (auth.uid() = user_id);
create policy "fixed_costs_update_own" on public.fixed_costs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fixed_costs_delete_own" on public.fixed_costs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- bank_transactions: Kontoauszug-Zeilen
-- ---------------------------------------------------------------------
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tx_date date not null,
  amount numeric not null,
  description text not null default '',
  type text not null default 'ausgabe',
  created_at timestamptz not null default now()
);

create index if not exists bank_transactions_user_id_idx on public.bank_transactions (user_id);
create index if not exists bank_transactions_tx_date_idx on public.bank_transactions (tx_date);

alter table public.bank_transactions enable row level security;

create policy "bank_transactions_select_own" on public.bank_transactions
  for select using (auth.uid() = user_id);
create policy "bank_transactions_insert_own" on public.bank_transactions
  for insert with check (auth.uid() = user_id);
create policy "bank_transactions_update_own" on public.bank_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bank_transactions_delete_own" on public.bank_transactions
  for delete using (auth.uid() = user_id);
