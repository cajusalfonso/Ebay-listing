-- ============================================================================
-- HostFlow — Phase 2: Storage-Bucket für Aufgaben-Fotos
-- Privater Bucket. Pfad-Konvention: <organization_id>/<task_id>/<dateiname>.
-- Zugriff strikt pro Organization über den ersten Pfad-Abschnitt.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do nothing;

-- Mitglieder einer Organization sehen nur Fotos im Ordner ihrer Organization.
create policy "task_photos_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "task_photos_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "task_photos_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-photos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_staff()
  );
