drop policy if exists "tenders_select_scope" on public.tenders;

create policy "tenders_select_scope" on public.tenders for select
using (
  public.current_profile_role() = 'ADMIN'
  or public.current_profile_role() = 'MANAGER'
  or uploaded_by = auth.uid()
  or assigned_to = auth.uid()
);
