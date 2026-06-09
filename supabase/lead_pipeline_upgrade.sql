create table if not exists public.lead_status_master (
  id uuid primary key default gen_random_uuid(),
  status_name text not null unique,
  sort_order integer not null,
  status_color text not null default '#173b71',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.lead_status_master (status_name, sort_order, status_color, is_active)
values
  ('New Lead', 1, '#173b71', true),
  ('First Contact', 2, '#2563eb', true),
  ('Contacted', 3, '#0f766e', true),
  ('Requirement Received', 4, '#0891b2', true),
  ('BOQ Requested', 5, '#7c3aed', true),
  ('BOQ Received', 6, '#4f46e5', true),
  ('Quotation Sent', 7, '#f97316', true),
  ('Technical Discussion', 8, '#d97706', true),
  ('Price Negotiation', 9, '#ea580c', true),
  ('Sample Submitted', 10, '#65a30d', true),
  ('PI Sent', 11, '#16a34a', true),
  ('PI Waiting Approval', 12, '#ca8a04', true),
  ('Order Expected', 13, '#0284c7', true),
  ('Order Received', 14, '#15803d', true),
  ('Lost To Competitor', 15, '#dc2626', true),
  ('No Requirement', 16, '#64748b', true),
  ('Not Reachable', 17, '#475569', true),
  ('Follow Up Required', 18, '#f59e0b', true),
  ('On Hold', 19, '#9333ea', true),
  ('Closed', 20, '#334155', true)
on conflict (status_name) do update
set sort_order = excluded.sort_order,
    status_color = excluded.status_color,
    is_active = excluded.is_active;

create table if not exists public.lead_remarks (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  remark text not null,
  created_at timestamptz not null default now()
);

create index if not exists lead_status_master_order_idx on public.lead_status_master(sort_order);
create index if not exists lead_remarks_tender_id_created_idx on public.lead_remarks(tender_id, created_at desc);
create index if not exists lead_remarks_user_id_idx on public.lead_remarks(user_id);

alter table public.lead_status_master enable row level security;
alter table public.lead_remarks enable row level security;

drop policy if exists "lead_status_master_read" on public.lead_status_master;
create policy "lead_status_master_read" on public.lead_status_master for select
using (auth.role() = 'authenticated');

drop policy if exists "lead_status_master_admin_write" on public.lead_status_master;
create policy "lead_status_master_admin_write" on public.lead_status_master for all
using (public.current_profile_role() = 'ADMIN')
with check (public.current_profile_role() = 'ADMIN');

drop policy if exists "lead_remarks_read" on public.lead_remarks;
create policy "lead_remarks_read" on public.lead_remarks for select
using (
  public.current_profile_role() in ('ADMIN','MANAGER')
  or user_id = auth.uid()
  or exists (
    select 1 from public.tenders t
    where t.id = tender_id
      and (t.assigned_to = auth.uid() or t.uploaded_by = auth.uid())
  )
);

drop policy if exists "lead_remarks_insert" on public.lead_remarks;
create policy "lead_remarks_insert" on public.lead_remarks for insert
with check (
  user_id = auth.uid()
  and (
    public.current_profile_role() in ('ADMIN','MANAGER')
    or exists (
      select 1 from public.tenders t
      where t.id = tender_id
        and t.assigned_to = auth.uid()
    )
  )
);
