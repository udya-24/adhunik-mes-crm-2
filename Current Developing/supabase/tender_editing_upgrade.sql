drop policy if exists "tenders_update_scope" on public.tenders;
create policy "tenders_update_scope" on public.tenders for update
using (
  public.current_profile_role() = 'ADMIN'
  or public.current_profile_role() = 'MANAGER'
  or uploaded_by = auth.uid()
  or exists (
    select 1
    from public.lead_assignments la
    where la.tender_id = id
      and la.assigned_to = auth.uid()
  )
)
with check (
  public.current_profile_role() = 'ADMIN'
  or public.current_profile_role() = 'MANAGER'
  or uploaded_by = auth.uid()
  or exists (
    select 1
    from public.lead_assignments la
    where la.tender_id = id
      and la.assigned_to = auth.uid()
  )
);

drop policy if exists "storage_authenticated_update" on storage.objects;
create policy "storage_authenticated_update" on storage.objects for update
using (
  bucket_id in ('boq','aoc','tender-documents','quotations')
  and auth.role() = 'authenticated'
)
with check (
  bucket_id in ('boq','aoc','tender-documents','quotations')
  and auth.role() = 'authenticated'
);
