-- Schulden-Tracking: Schulden anlegen und Abzahlungen erfassen.
-- Im Supabase SQL Editor ausfuehren, nachdem 0001 und 0002 bereits liefen.

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default '',
  total_amount numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on public.debts (user_id);

alter table public.debts enable row level security;

create policy "debts_select_own" on public.debts
  for select using (auth.uid() = user_id);
create policy "debts_insert_own" on public.debts
  for insert with check (auth.uid() = user_id);
create policy "debts_update_own" on public.debts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "debts_delete_own" on public.debts
  for delete using (auth.uid() = user_id);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists debt_payments_user_id_idx on public.debt_payments (user_id);
create index if not exists debt_payments_debt_id_idx on public.debt_payments (debt_id);

alter table public.debt_payments enable row level security;

create policy "debt_payments_select_own" on public.debt_payments
  for select using (auth.uid() = user_id);
create policy "debt_payments_insert_own" on public.debt_payments
  for insert with check (auth.uid() = user_id);
create policy "debt_payments_update_own" on public.debt_payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "debt_payments_delete_own" on public.debt_payments
  for delete using (auth.uid() = user_id);
