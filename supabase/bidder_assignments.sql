-- Bidder ownership (additive migration).
-- Run after schema.sql/lead_pipeline_upgrade.sql and before lead_distribution.sql.

create table if not exists public.bidder_assignments (
  id uuid primary key default gen_random_uuid(),
  bidder_name text not null check (btrim(bidder_name) <> ''),
  assigned_user uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  is_active boolean not null default true,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bidder_assignments_active_name_uidx
  on public.bidder_assignments (lower(btrim(bidder_name))) where is_active;
create index if not exists bidder_assignments_name_idx
  on public.bidder_assignments (lower(btrim(bidder_name)));
create index if not exists bidder_assignments_assigned_user_idx
  on public.bidder_assignments (assigned_user);
create index if not exists bidder_assignments_is_active_idx
  on public.bidder_assignments (is_active);

alter table public.bidder_assignments enable row level security;
-- Deliberately no policies: like assignment_batches, this table is managed by
-- authenticated server actions/RPCs without changing the application's RLS model.

create or replace function public.touch_bidder_assignment()
returns trigger language plpgsql set search_path = public as $$
begin
  new.bidder_name := btrim(new.bidder_name);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bidder_assignments_touch on public.bidder_assignments;
create trigger bidder_assignments_touch before insert or update on public.bidder_assignments
for each row execute function public.touch_bidder_assignment();

create or replace function public.apply_bidder_assignment_to_tender()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rule public.bidder_assignments;
  v_status_id uuid;
begin
  -- Bidder ownership has the highest priority and is evaluated before the
  -- tender can enter the pool used by manual/automatic distribution.
  if nullif(btrim(new.bidder_name), '') is null then
    return new;
  end if;

  select * into v_rule from public.bidder_assignments ba
  where ba.is_active and lower(btrim(ba.bidder_name)) = lower(btrim(new.bidder_name))
  limit 1;
  if v_rule.id is null then return new; end if;

  update public.tenders set assigned_to = v_rule.assigned_user,
    assigned_by = v_rule.assigned_by, updated_at = now()
  where id = new.id and assigned_to is distinct from v_rule.assigned_user;
  if not found then return new; end if;

  insert into public.lead_assignments(tender_id, assigned_to, assigned_by, assigned_date, remarks)
  values (new.id, v_rule.assigned_user, v_rule.assigned_by, now(),
    'Automatic bidder assignment: ' || v_rule.bidder_name);

  insert into public.lead_activities(tender_id, user_id, activity_type, activity_notes)
  values (new.id, v_rule.assigned_by, 'BIDDER_AUTO_ASSIGNED',
    'Automatically assigned to bidder owner for ' || v_rule.bidder_name);

  -- Keep a lead-status history entry when the pipeline upgrade is installed.
  if to_regclass('public.lead_status_history') is not null then
    select id into v_status_id from public.lead_status_master
      where status_name = 'New Lead' limit 1;
    if v_status_id is not null then
      execute 'insert into public.lead_status_history(tender_id,status_id,updated_by,remarks) values ($1,$2,$3,$4)'
      using new.id, v_status_id, v_rule.assigned_by,
        'Automatic bidder assignment: ' || v_rule.bidder_name;
    end if;
  end if;

  insert into public.audit_logs(table_name, record_id, user_id, action, old_data, new_data)
  values ('tenders', new.id::text, v_rule.assigned_by,
    'AUTOMATIC_BIDDER_ASSIGNMENT_EXECUTED',
    jsonb_build_object('assigned_to', new.assigned_to, 'bidder_name', new.bidder_name),
    jsonb_build_object('assigned_to', v_rule.assigned_user, 'bidder_assignment_id', v_rule.id));
  return new;
end $$;

drop trigger if exists tenders_apply_bidder_assignment on public.tenders;
create trigger tenders_apply_bidder_assignment
after insert or update of bidder_name on public.tenders
for each row execute function public.apply_bidder_assignment_to_tender();

-- Upgrade the existing distribution RPCs by replacing every unassigned-pool
-- predicate with this additional NOT EXISTS guard (the statements below are
-- intentionally documented here; lead_distribution.sql contains the executable changes).
