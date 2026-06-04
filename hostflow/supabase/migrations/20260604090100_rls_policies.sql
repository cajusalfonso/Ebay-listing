-- ============================================================================
-- HostFlow — Phase 2: Row Level Security
-- Strikte Mandantentrennung pro organization_id. cleaner/maintenance sehen nur
-- ihre zugewiesenen Aufgaben + eigene Zeiteinträge.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper-Funktionen (SECURITY DEFINER → umgehen RLS, verhindern Rekursion)
-- ----------------------------------------------------------------------------

-- Organization des aktuell angemeldeten Nutzers.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- Rolle des aktuell angemeldeten Nutzers.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- True, wenn owner oder manager (= Voll-/Verwaltungszugriff).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'manager')
  );
$$;

-- True, wenn owner (für Billing/Abo & Account-Löschung).
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

revoke all on function public.current_org_id() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_owner() from public;
grant execute on function public.current_org_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Tabellen-Privilegien: authenticated arbeitet ausschließlich unter RLS.
-- service_role (Server/Sync/Webhooks) umgeht RLS per Supabase-Default.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

-- ----------------------------------------------------------------------------
-- RLS aktivieren
-- ----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.invitations   enable row level security;
alter table public.properties    enable row level security;
alter table public.bookings      enable row level security;
alter table public.tasks         enable row level security;
alter table public.task_photos   enable row level security;
alter table public.time_entries  enable row level security;
alter table public.expenses      enable row level security;
alter table public.activity_log  enable row level security;

-- ----------------------------------------------------------------------------
-- organizations: Mitglieder sehen die eigene Org; nur owner ändert sie.
-- (INSERT läuft über die onboard_owner()-RPC; Billing-Felder via service_role.)
-- ----------------------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.current_org_id());

create policy organizations_update on public.organizations
  for update to authenticated
  using (id = public.current_org_id() and public.is_owner())
  with check (id = public.current_org_id() and public.is_owner());

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (id = public.current_org_id() and public.is_owner());

-- ----------------------------------------------------------------------------
-- profiles: owner/manager sehen das ganze Team; cleaner/maintenance nur sich.
-- ----------------------------------------------------------------------------
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

-- Selbst-Anlage des Profils während des Onboardings (id muss = auth.uid()).
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- Nutzer ändern den eigenen Namen; owner/manager verwalten das Team.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_staff on public.profiles
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_staff())
  with check (organization_id = public.current_org_id() and public.is_staff());

create policy profiles_delete_staff on public.profiles
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_staff() and id <> auth.uid());

-- ----------------------------------------------------------------------------
-- invitations: nur owner/manager verwalten Einladungen.
-- (Annahme einer Einladung läuft über accept_invitation()-RPC.)
-- ----------------------------------------------------------------------------
create policy invitations_select_staff on public.invitations
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

create policy invitations_insert_staff on public.invitations
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_staff());

create policy invitations_update_staff on public.invitations
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_staff())
  with check (organization_id = public.current_org_id() and public.is_staff());

create policy invitations_delete_staff on public.invitations
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

-- ----------------------------------------------------------------------------
-- properties: owner/manager voll; cleaner/maintenance nur Objekte mit einer
-- ihnen zugewiesenen Aufgabe (Lesen, für Adresse/Navigation).
-- ----------------------------------------------------------------------------
create policy properties_select_staff on public.properties
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

create policy properties_select_assigned on public.properties
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.tasks t
      where t.property_id = properties.id and t.assigned_to = auth.uid()
    )
  );

create policy properties_write_staff on public.properties
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_staff())
  with check (organization_id = public.current_org_id() and public.is_staff());

-- ----------------------------------------------------------------------------
-- bookings: nur owner/manager (cleaner brauchen keine Gästedaten).
-- ----------------------------------------------------------------------------
create policy bookings_all_staff on public.bookings
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_staff())
  with check (organization_id = public.current_org_id() and public.is_staff());

-- ----------------------------------------------------------------------------
-- tasks: owner/manager voll; cleaner/maintenance nur zugewiesene Aufgaben.
-- ----------------------------------------------------------------------------
create policy tasks_select_staff on public.tasks
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

create policy tasks_select_assigned on public.tasks
  for select to authenticated
  using (organization_id = public.current_org_id() and assigned_to = auth.uid());

create policy tasks_insert_staff on public.tasks
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_staff());

-- owner/manager dürfen alle Aufgaben ändern …
create policy tasks_update_staff on public.tasks
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_staff())
  with check (organization_id = public.current_org_id() and public.is_staff());

-- … zugewiesene Mitarbeiter nur ihre eigenen (z. B. abhaken).
create policy tasks_update_assigned on public.tasks
  for update to authenticated
  using (organization_id = public.current_org_id() and assigned_to = auth.uid())
  with check (organization_id = public.current_org_id() and assigned_to = auth.uid());

create policy tasks_delete_staff on public.tasks
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

-- ----------------------------------------------------------------------------
-- task_photos: owner/manager voll; Mitarbeiter Fotos ihrer Aufgaben.
-- ----------------------------------------------------------------------------
create policy task_photos_select_staff on public.task_photos
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

create policy task_photos_select_assigned on public.task_photos
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_photos.task_id and t.assigned_to = auth.uid()
    )
  );

create policy task_photos_insert_member on public.task_photos
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and uploaded_by = auth.uid()
    and (
      public.is_staff()
      or exists (
        select 1 from public.tasks t
        where t.id = task_photos.task_id and t.assigned_to = auth.uid()
      )
    )
  );

create policy task_photos_delete_staff on public.task_photos
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_staff() or uploaded_by = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- time_entries: owner/manager sehen alle; Mitarbeiter nur eigene.
-- ----------------------------------------------------------------------------
create policy time_entries_select_staff on public.time_entries
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

create policy time_entries_select_own on public.time_entries
  for select to authenticated
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy time_entries_insert_own on public.time_entries
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_staff() or user_id = auth.uid())
  );

create policy time_entries_update_own on public.time_entries
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_staff() or user_id = auth.uid())
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_staff() or user_id = auth.uid())
  );

create policy time_entries_delete_own on public.time_entries
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_staff() or user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- expenses: nur owner/manager (Kosten sind vor Mitarbeitern verborgen).
-- ----------------------------------------------------------------------------
create policy expenses_all_staff on public.expenses
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_staff())
  with check (organization_id = public.current_org_id() and public.is_staff());

-- ----------------------------------------------------------------------------
-- activity_log: owner/manager lesen den Feed; jeder schreibt eigene Einträge.
-- Append-only (kein UPDATE/DELETE für authenticated).
-- ----------------------------------------------------------------------------
create policy activity_log_select_staff on public.activity_log
  for select to authenticated
  using (organization_id = public.current_org_id() and public.is_staff());

create policy activity_log_insert_member on public.activity_log
  for insert to authenticated
  with check (organization_id = public.current_org_id() and user_id = auth.uid());
