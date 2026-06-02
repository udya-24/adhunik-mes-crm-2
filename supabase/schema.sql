create extension if not exists "pgcrypto";

create type app_role as enum ('ADMIN', 'MANAGER', 'USER');
create type lead_status as enum ('NEW', 'ASSIGNED', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST');
create type source_type as enum ('EXCEL_UPLOAD', 'MANUAL_ENTRY');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null unique,
  role app_role not null default 'USER',
  manager_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  tender_id text not null unique,
  organisation_chain text,
  ge text,
  cwe text,
  tender_ref_no text,
  tender_title text,
  contract_date date,
  bid_number text,
  bidder_name text,
  currency text default 'INR',
  awarded_value numeric,
  contact_number_1 text,
  contact_number_2 text,
  contact_number_3 text,
  address text,
  make text,
  email text,
  boq_attachment_url text,
  aoc_attachment_url text,
  tender_document_url text,
  our_value numeric,
  source_type source_type not null default 'MANUAL_ENTRY',
  uploaded_by uuid references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  assigned_by uuid references public.profiles(id),
  lead_status lead_status not null default 'NEW',
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_assignments (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  assigned_date timestamptz not null default now(),
  remarks text
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  activity_type text not null,
  activity_notes text,
  created_at timestamptz not null default now()
);

create table public.upload_history (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id),
  file_name text not null,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  source_type source_type not null default 'EXCEL_UPLOAD',
  created_at timestamptz not null default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  follow_up_date timestamptz not null,
  remarks text not null,
  status lead_status not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  user_id uuid references public.profiles(id),
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_lead_scores (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  score numeric,
  explanation text,
  model_version text,
  created_at timestamptz not null default now()
);

create table public.ai_tender_summaries (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders(id) on delete cascade,
  summary text,
  risk_flags jsonb default '[]',
  created_at timestamptz not null default now()
);

create index tenders_assigned_to_idx on public.tenders(assigned_to);
create index tenders_ge_idx on public.tenders(ge);
create index tenders_cwe_idx on public.tenders(cwe);
create index tenders_status_idx on public.tenders(lead_status);
create index tenders_is_deleted_idx on public.tenders(is_deleted);
create index lead_assignments_tender_id_idx on public.lead_assignments(tender_id);
create index lead_assignments_assigned_to_idx on public.lead_assignments(assigned_to);
create index lead_activities_tender_id_idx on public.lead_activities(tender_id);
create index lead_activities_user_id_idx on public.lead_activities(user_id);
create index follow_ups_tender_id_idx on public.follow_ups(tender_id);
create index follow_ups_user_id_idx on public.follow_ups(user_id);
create index follow_ups_date_idx on public.follow_ups(follow_up_date);

create or replace function public.current_profile_role()
returns app_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.is_team_member(user_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = user_id and (p.manager_id = auth.uid() or p.id = auth.uid())
  )
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenders_set_updated_at before update on public.tenders
for each row execute function public.set_updated_at();

create or replace function public.prevent_non_admin_tender_soft_delete()
returns trigger language plpgsql as $$
begin
  if (
    old.is_deleted is distinct from new.is_deleted
    or old.deleted_at is distinct from new.deleted_at
    or old.deleted_by is distinct from new.deleted_by
  ) and public.current_profile_role() <> 'ADMIN' then
    raise exception 'Only admins can delete or restore tenders';
  end if;

  return new;
end;
$$;

create trigger tenders_admin_soft_delete_guard before update on public.tenders
for each row execute function public.prevent_non_admin_tender_soft_delete();

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

alter table public.profiles enable row level security;
alter table public.tenders enable row level security;
alter table public.lead_assignments enable row level security;
alter table public.lead_activities enable row level security;
alter table public.upload_history enable row level security;
alter table public.follow_ups enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_lead_scores enable row level security;
alter table public.ai_tender_summaries enable row level security;

create policy "profiles_select_by_role" on public.profiles for select
using (is_active = true or id = auth.uid() or public.current_profile_role() in ('ADMIN','MANAGER'));

create policy "profiles_admin_write" on public.profiles for all
using (public.current_profile_role() = 'ADMIN')
with check (public.current_profile_role() = 'ADMIN');

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

create policy "tenders_manual_insert_scope" on public.tenders for insert
with check (
  public.current_profile_role() in ('ADMIN','MANAGER','USER')
  and (
    source_type = 'MANUAL_ENTRY'
    or public.current_profile_role() in ('ADMIN','MANAGER')
  )
);

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

create policy "assignment_read" on public.lead_assignments for select
using (public.current_profile_role() in ('ADMIN','MANAGER') or assigned_to = auth.uid());

create policy "assignment_write" on public.lead_assignments for insert
with check (public.current_profile_role() in ('ADMIN','MANAGER'));

create policy "activities_read" on public.lead_activities for select
using (public.current_profile_role() in ('ADMIN','MANAGER') or user_id = auth.uid());

create policy "activities_write" on public.lead_activities for insert
with check (user_id = auth.uid() or public.current_profile_role() in ('ADMIN','MANAGER'));

create policy "upload_history_admin_manager" on public.upload_history for all
using (public.current_profile_role() in ('ADMIN','MANAGER'))
with check (public.current_profile_role() in ('ADMIN','MANAGER'));

create policy "followups_scope" on public.follow_ups for select
using (public.current_profile_role() in ('ADMIN','MANAGER') or user_id = auth.uid());

create policy "followups_write" on public.follow_ups for insert
with check (user_id = auth.uid());

create policy "audit_admin_read" on public.audit_logs for select
using (public.current_profile_role() = 'ADMIN');

create policy "audit_admin_insert" on public.audit_logs for insert
with check (public.current_profile_role() = 'ADMIN');

create policy "ai_admin_manager_read" on public.ai_lead_scores for select
using (public.current_profile_role() in ('ADMIN','MANAGER'));

create policy "ai_summary_read" on public.ai_tender_summaries for select
using (public.current_profile_role() in ('ADMIN','MANAGER'));

insert into storage.buckets (id, name, public)
values
  ('boq', 'boq', true),
  ('aoc', 'aoc', true),
  ('tender-documents', 'tender-documents', true),
  ('quotations', 'quotations', false)
on conflict (id) do nothing;

create policy "storage_authenticated_read" on storage.objects for select
using (bucket_id in ('boq','aoc','tender-documents','quotations') and auth.role() = 'authenticated');

create policy "storage_authenticated_upload" on storage.objects for insert
with check (
  bucket_id in ('boq','aoc','tender-documents','quotations')
  and auth.role() = 'authenticated'
);
