do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lead_assignments_tender_id_fkey') then
    alter table public.lead_assignments
      add constraint lead_assignments_tender_id_fkey
      foreign key (tender_id) references public.tenders(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_assignments_assigned_to_fkey') then
    alter table public.lead_assignments
      add constraint lead_assignments_assigned_to_fkey
      foreign key (assigned_to) references public.profiles(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_assignments_assigned_by_fkey') then
    alter table public.lead_assignments
      add constraint lead_assignments_assigned_by_fkey
      foreign key (assigned_by) references public.profiles(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'follow_ups_tender_id_fkey') then
    alter table public.follow_ups
      add constraint follow_ups_tender_id_fkey
      foreign key (tender_id) references public.tenders(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'follow_ups_user_id_fkey') then
    alter table public.follow_ups
      add constraint follow_ups_user_id_fkey
      foreign key (user_id) references public.profiles(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_activities_tender_id_fkey') then
    alter table public.lead_activities
      add constraint lead_activities_tender_id_fkey
      foreign key (tender_id) references public.tenders(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_activities_user_id_fkey') then
    alter table public.lead_activities
      add constraint lead_activities_user_id_fkey
      foreign key (user_id) references public.profiles(id);
  end if;
end $$;

create index if not exists lead_assignments_tender_id_idx on public.lead_assignments(tender_id);
create index if not exists lead_assignments_assigned_to_idx on public.lead_assignments(assigned_to);
create index if not exists lead_activities_tender_id_idx on public.lead_activities(tender_id);
create index if not exists lead_activities_user_id_idx on public.lead_activities(user_id);
create index if not exists follow_ups_tender_id_idx on public.follow_ups(tender_id);
create index if not exists follow_ups_user_id_idx on public.follow_ups(user_id);

create or replace view public.tender_assignments_view
with (security_invoker = true)
as
select
  t.*,
  p.full_name as assigned_user_name,
  p.email as assigned_user_email,
  la.assigned_date
from public.tenders t
left join public.lead_assignments la
  on la.tender_id = t.id
left join public.profiles p
  on p.id = la.assigned_to;

grant select on public.tender_assignments_view to authenticated;

drop policy if exists "tenders_select_scope" on public.tenders;
create policy "tenders_select_scope" on public.tenders for select
using (
  public.current_profile_role() = 'ADMIN'
  or public.current_profile_role() = 'MANAGER'
  or exists (
    select 1
    from public.lead_assignments la
    where la.tender_id = id
      and la.assigned_to = auth.uid()
  )
);

drop policy if exists "tenders_update_scope" on public.tenders;
create policy "tenders_update_scope" on public.tenders for update
using (
  public.current_profile_role() = 'ADMIN'
  or public.current_profile_role() = 'MANAGER'
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
  or exists (
    select 1
    from public.lead_assignments la
    where la.tender_id = id
      and la.assigned_to = auth.uid()
  )
);
