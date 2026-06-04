-- ============================================================================
-- HostFlow — Phase 2: RPC-Funktionen für Onboarding & Einladungen
-- Laufen als SECURITY DEFINER, damit Onboarding-Schreibvorgänge möglich sind,
-- ohne die RLS-Policies aufzuweichen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- onboard_owner — legt bei der Registrierung eine neue Organization an und
-- macht den aktuellen Nutzer zum owner. Idempotenz: schlägt fehl, wenn der
-- Nutzer bereits ein Profil hat.
-- ----------------------------------------------------------------------------
create or replace function public.onboard_owner(org_name text, owner_name text default '')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;

  if length(trim(coalesce(org_name, ''))) = 0 then
    raise exception 'Name der Organisation fehlt';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profil existiert bereits';
  end if;

  insert into public.organizations (name)
  values (trim(org_name))
  returning id into new_org_id;

  insert into public.profiles (id, organization_id, full_name, role)
  values (auth.uid(), new_org_id, trim(coalesce(owner_name, '')), 'owner');

  insert into public.activity_log (organization_id, user_id, action, entity_type, entity_id, meta)
  values (new_org_id, auth.uid(), 'organization.created', 'organization', new_org_id,
          jsonb_build_object('name', trim(org_name)));

  return new_org_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- accept_invitation — Nutzer tritt per Einladungs-Token einer Organization
-- bei. Prüft E-Mail, Ablauf und Status; legt das Profil mit Rolle/Stundensatz
-- aus der Einladung an.
-- ----------------------------------------------------------------------------
create or replace function public.accept_invitation(invitation_token uuid, member_name text default '')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inv public.invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert';
  end if;

  select * into inv
  from public.invitations
  where token = invitation_token
  for update;

  if not found then
    raise exception 'Einladung nicht gefunden';
  end if;

  if inv.status <> 'pending' then
    raise exception 'Einladung ist nicht mehr gültig';
  end if;

  if inv.expires_at < now() then
    raise exception 'Einladung ist abgelaufen';
  end if;

  if lower(inv.email) <> lower(coalesce(auth.email(), '')) then
    raise exception 'Einladung gehört zu einer anderen E-Mail-Adresse';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profil existiert bereits';
  end if;

  insert into public.profiles (id, organization_id, full_name, role, hourly_rate)
  values (auth.uid(), inv.organization_id, trim(coalesce(member_name, '')), inv.role, inv.hourly_rate);

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = inv.id;

  insert into public.activity_log (organization_id, user_id, action, entity_type, entity_id, meta)
  values (inv.organization_id, auth.uid(), 'member.joined', 'profile', auth.uid(),
          jsonb_build_object('role', inv.role));

  return inv.organization_id;
end;
$$;

revoke all on function public.onboard_owner(text, text) from public;
revoke all on function public.accept_invitation(uuid, text) from public;
grant execute on function public.onboard_owner(text, text) to authenticated;
grant execute on function public.accept_invitation(uuid, text) to authenticated;
