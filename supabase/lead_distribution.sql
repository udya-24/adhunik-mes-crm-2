-- Lead Distribution Engine (additive migration)
-- Keeps tenders.assigned_to as the workload source of truth and preserves lead_assignments history.
-- Compatible with MES installations where profiles.role is TEXT.

-- Fail early with a useful message if this is run against a database that is not the MES CRM.
do $$
declare
  v_table text;
  v_column record;
begin
  foreach v_table in array array['profiles', 'tenders', 'lead_assignments', 'follow_ups', 'audit_logs']
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Required MES CRM table public.% does not exist', v_table;
    end if;
  end loop;

  for v_column in
    select * from (values
      ('profiles','id'), ('profiles','full_name'), ('profiles','email'), ('profiles','role'), ('profiles','is_active'),
      ('tenders','id'), ('tenders','assigned_to'), ('tenders','assigned_by'), ('tenders','updated_at'),
      ('tenders','deleted_at'), ('tenders','created_at'), ('tenders','lead_status'), ('tenders','awarded_value'),
      ('lead_assignments','tender_id'), ('lead_assignments','assigned_to'), ('lead_assignments','assigned_by'),
      ('lead_assignments','assigned_date'), ('lead_assignments','remarks'),
      ('follow_ups','id'), ('follow_ups','user_id'),
      ('audit_logs','table_name'), ('audit_logs','record_id'), ('audit_logs','user_id'),
      ('audit_logs','action'), ('audit_logs','old_data'), ('audit_logs','new_data')
    ) required(table_name, column_name)
  loop
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = v_column.table_name
        and c.column_name = v_column.column_name
    ) then
      raise exception 'Required MES CRM column public.%.% does not exist', v_column.table_name, v_column.column_name;
    end if;
  end loop;
end;
$$;

create table if not exists public.assignment_batches (
  id uuid primary key default gen_random_uuid(),
  started_by uuid not null references public.profiles(id),
  started_at timestamptz not null default now(),
  algorithm text not null check (algorithm in ('LEAST_LOADED', 'ROUND_ROBIN', 'RANDOM')),
  scope text not null check (scope in ('UNASSIGNED_ONLY', 'ALL_ACTIVE')),
  quantity_mode text not null default 'ALL_UNASSIGNED',
  quantity_value bigint not null default 0,
  assignment_order text not null default 'OLDEST_FIRST',
  requested_quantity bigint not null default 0,
  available_tenders bigint not null default 0,
  remaining_quantity bigint not null default 0,
  duration_ms bigint,
  selected_users uuid[] not null,
  total_tenders bigint not null default 0,
  completed_tenders bigint not null default 0,
  status text not null default 'PENDING' check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  completed_at timestamptz,
  constraint assignment_batches_selected_users_check check (cardinality(selected_users) > 0)
);

-- Rerunnable upgrade path for databases that already ran the first Lead Distribution migration.
alter table public.assignment_batches add column if not exists quantity_mode text not null default 'ALL_UNASSIGNED';
alter table public.assignment_batches add column if not exists quantity_value bigint not null default 0;
alter table public.assignment_batches add column if not exists assignment_order text not null default 'OLDEST_FIRST';
alter table public.assignment_batches add column if not exists requested_quantity bigint not null default 0;
alter table public.assignment_batches add column if not exists available_tenders bigint not null default 0;
alter table public.assignment_batches add column if not exists remaining_quantity bigint not null default 0;
alter table public.assignment_batches add column if not exists duration_ms bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assignment_batches_quantity_mode_check') then
    alter table public.assignment_batches add constraint assignment_batches_quantity_mode_check
      check (quantity_mode in ('ALL_UNASSIGNED','SPECIFIC_NUMBER','KEEP_UNASSIGNED'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignment_batches_assignment_order_check') then
    alter table public.assignment_batches add constraint assignment_batches_assignment_order_check
      check (assignment_order in ('OLDEST_FIRST','NEWEST_FIRST','HIGHEST_VALUE','LOWEST_VALUE','RANDOM'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assignment_batches_quantities_check') then
    alter table public.assignment_batches add constraint assignment_batches_quantities_check
      check (quantity_value >= 0 and requested_quantity >= 0 and available_tenders >= 0 and remaining_quantity >= 0);
  end if;
end;
$$;

create table if not exists public.assignment_batch_items (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.assignment_batches(id) on delete cascade,
  tender_id uuid not null references public.tenders(id) on delete cascade,
  old_user uuid references public.profiles(id),
  new_user uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unique (batch_id, tender_id)
);

create index if not exists tenders_distribution_unassigned_idx
  on public.tenders (created_at, id)
  where assigned_to is null and deleted_at is null;
create index if not exists tenders_distribution_workload_idx
  on public.tenders (assigned_to)
  where deleted_at is null;
create index if not exists assignment_batches_started_at_idx
  on public.assignment_batches (started_at desc);
create index if not exists assignment_batches_status_idx
  on public.assignment_batches (status, started_at desc);
create index if not exists assignment_batch_items_batch_idx
  on public.assignment_batch_items (batch_id, assigned_at, id);
create index if not exists assignment_batch_items_assigned_at_idx
  on public.assignment_batch_items (assigned_at desc);

-- New tables are service-side implementation details. No policies are added or changed.
alter table public.assignment_batches enable row level security;
alter table public.assignment_batch_items enable row level security;

-- Drop only this migration's RPCs so a previously attempted enum-based version can be replaced.
drop function if exists public.lead_distribution_pool();
drop function if exists public.preview_lead_distribution(text, text, uuid[]);
drop function if exists public.create_assignment_batch(text, text, uuid[]);
drop function if exists public.preview_lead_distribution(text, text, text, bigint, uuid[]);
drop function if exists public.create_assignment_batch(text, text, text, bigint, uuid[]);
drop function if exists public.process_assignment_batch(uuid, integer);
drop function if exists public.lead_distribution_analytics();

create or replace function public.lead_distribution_pool()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  current_assigned bigint,
  current_active bigint,
  total_awarded_value numeric,
  follow_up_count bigint,
  last_login timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.role::text,
    coalesce(t.current_assigned, 0), coalesce(t.current_active, 0),
    coalesce(t.total_awarded_value, 0), coalesce(f.follow_up_count, 0),
    null::timestamptz as last_login
  from public.profiles p
  left join lateral (
    select count(*)::bigint current_assigned,
      count(*) filter (where lead_status not in ('WON','LOST'))::bigint current_active,
      coalesce(sum(awarded_value), 0) total_awarded_value
    from public.tenders where assigned_to = p.id and deleted_at is null
  ) t on true
  left join lateral (select count(*)::bigint follow_up_count from public.follow_ups where user_id = p.id) f on true
  where exists (
      select 1 from public.profiles current_user_profile
      where current_user_profile.id = auth.uid()
        and current_user_profile.is_active = true
        and current_user_profile.role = 'ADMIN'
    )
    and p.is_active = true and p.role in ('USER', 'MANAGER')
  order by coalesce(p.full_name, p.email);
$$;

create or replace function public.preview_lead_distribution(
  p_algorithm text,
  p_assignment_order text,
  p_quantity_mode text,
  p_quantity_value bigint,
  p_selected_users uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_assigning bigint;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'ADMIN'
  ) then raise exception 'Admin access required'; end if;
  if p_algorithm not in ('LEAST_LOADED','ROUND_ROBIN','RANDOM') then raise exception 'Invalid algorithm'; end if;
  if p_assignment_order not in ('OLDEST_FIRST','NEWEST_FIRST','HIGHEST_VALUE','LOWEST_VALUE','RANDOM') then raise exception 'Invalid assignment order'; end if;
  if p_quantity_mode not in ('ALL_UNASSIGNED','SPECIFIC_NUMBER','KEEP_UNASSIGNED') then raise exception 'Invalid quantity mode'; end if;
  if coalesce(p_quantity_value, 0) < 0 then raise exception 'Quantity cannot be negative'; end if;
  if coalesce(cardinality(p_selected_users), 0) = 0 then raise exception 'Select at least one user'; end if;
  if cardinality(p_selected_users) <> (select count(distinct u.id) from unnest(p_selected_users) u(id)) then
    raise exception 'Distribution pool contains duplicate users';
  end if;
  if exists (
    select 1 from unnest(p_selected_users) u(id)
    left join public.profiles p on p.id = u.id
    where p.id is null or not p.is_active or p.role not in ('USER','MANAGER')
  ) then raise exception 'Distribution pool contains an inactive or invalid user'; end if;

  select count(*) into v_total from public.tenders t
  where t.deleted_at is null and t.assigned_to is null
    and not exists (
      select 1 from public.bidder_assignments ba
      where ba.is_active and lower(btrim(ba.bidder_name)) = lower(btrim(t.bidder_name))
    );

  v_assigning := case p_quantity_mode
    when 'SPECIFIC_NUMBER' then least(p_quantity_value, v_total)
    when 'KEEP_UNASSIGNED' then greatest(v_total - p_quantity_value, 0)
    else v_total
  end;

  with pool as (
    select p.id, coalesce(p.full_name, p.email) name,
      count(t.id)::bigint workload,
      row_number() over (order by p.id) - 1 rr
    from public.profiles p
    left join public.tenders t on t.assigned_to = p.id and t.deleted_at is null
    where p.id = any(p_selected_users)
    group by p.id, p.full_name, p.email
  ), allocations as (
    select id, name, workload,
      case
        when p_algorithm in ('ROUND_ROBIN','RANDOM') then
          (v_assigning / cardinality(p_selected_users)) + case when rr < (v_assigning % cardinality(p_selected_users)) then 1 else 0 end
        else 0
      end::bigint assigned
    from pool
  ), least_slots as materialized (
    -- Select the next N capacity slots ordered by resulting workload. This is preview-only;
    -- the execution RPC recalculates least-load per chunk to remain concurrency-safe.
    select p.id
    from pool p cross join lateral generate_series(1, v_assigning) s(n)
    where p_algorithm = 'LEAST_LOADED'
    order by p.workload + s.n, p.id
    limit v_assigning
  ), least_loaded as (
    select id, count(*)::bigint assigned from least_slots
    group by id
  ), final_rows as (
    select a.id, a.name, a.workload,
      case when p_algorithm = 'LEAST_LOADED' then coalesce(l.assigned, 0) else a.assigned end assigned
    from allocations a left join least_loaded l on l.id = a.id
  )
  select jsonb_build_object(
    'totalTenders', v_total,
    'assigning', v_assigning,
    'remaining', v_total - v_assigning,
    'assignmentOrder', p_assignment_order,
    'quantityMode', p_quantity_mode,
    'quantityValue', p_quantity_value,
    'warning', case
      when p_quantity_mode = 'SPECIFIC_NUMBER' and p_quantity_value > v_total
      then 'Only ' || v_total || ' unassigned leads are available.'
      when p_quantity_mode = 'KEEP_UNASSIGNED' and p_quantity_value > v_total
      then 'Only ' || v_total || ' unassigned leads are available.'
      else null
    end,
    'algorithm', p_algorithm,
    'allocations', coalesce(jsonb_agg(jsonb_build_object(
      'userId', id, 'name', name, 'currentWorkload', workload, 'assigned', assigned
    ) order by name), '[]'::jsonb)
  ) into v_result from final_rows;
  return v_result;
end;
$$;

create or replace function public.create_assignment_batch(
  p_algorithm text,
  p_assignment_order text,
  p_quantity_mode text,
  p_quantity_value bigint,
  p_selected_users uuid[]
)
returns public.assignment_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.assignment_batches;
  v_preview jsonb;
  v_available bigint;
  v_assigning bigint;
begin
  v_preview := public.preview_lead_distribution(p_algorithm, p_assignment_order, p_quantity_mode, p_quantity_value, p_selected_users);
  v_available := (v_preview->>'totalTenders')::bigint;
  v_assigning := (v_preview->>'assigning')::bigint;
  insert into public.assignment_batches(
    started_by, algorithm, scope, selected_users, total_tenders,
    quantity_mode, quantity_value, assignment_order, requested_quantity, available_tenders, remaining_quantity
  )
  values (
    auth.uid(), p_algorithm, 'UNASSIGNED_ONLY', p_selected_users, v_assigning,
    p_quantity_mode, p_quantity_value, p_assignment_order,
    case when p_quantity_mode = 'SPECIFIC_NUMBER' then p_quantity_value else v_assigning end,
    v_available, v_available - v_assigning
  )
  returning * into v_batch;
  insert into public.audit_logs(table_name, record_id, user_id, action, new_data)
  values ('assignment_batches', v_batch.id::text, auth.uid(), 'AUTO_ASSIGNMENT_BATCH_STARTED', to_jsonb(v_batch));
  return v_batch;
end;
$$;

create or replace function public.process_assignment_batch(p_batch_id uuid, p_chunk_size integer default 1000)
returns public.assignment_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.assignment_batches;
  v_now timestamptz := clock_timestamp();
  v_count bigint;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'ADMIN'
  ) then raise exception 'Admin access required'; end if;
  if p_chunk_size < 1 or p_chunk_size > 5000 then raise exception 'Chunk size must be between 1 and 5000'; end if;
  perform pg_advisory_xact_lock(hashtext(p_batch_id::text));
  select * into v_batch from public.assignment_batches where id = p_batch_id for update;
  if v_batch.id is null then raise exception 'Batch not found'; end if;
  if v_batch.started_by <> auth.uid() then raise exception 'Only the batch owner can process this batch'; end if;
  if v_batch.status in ('COMPLETED','FAILED') then return v_batch; end if;
  update public.assignment_batches set status = 'RUNNING' where id = p_batch_id;

  create temporary table if not exists pg_temp.distribution_chunk(
    seq bigint, tender_id uuid primary key, old_user uuid, new_user uuid
  ) on commit drop;
  truncate pg_temp.distribution_chunk;

  with locked_candidates as materialized (
    select t.id tender_id, t.assigned_to old_user, t.created_at
    from public.tenders t
    where t.deleted_at is null
      and t.assigned_to is null
      and not exists (
        select 1 from public.bidder_assignments ba
        where ba.is_active and lower(btrim(ba.bidder_name)) = lower(btrim(t.bidder_name))
      )
      and not exists (select 1 from public.assignment_batch_items i where i.batch_id = p_batch_id and i.tender_id = t.id)
    order by
      case when v_batch.assignment_order = 'OLDEST_FIRST' then t.created_at end asc,
      case when v_batch.assignment_order = 'NEWEST_FIRST' then t.created_at end desc,
      case when v_batch.assignment_order = 'HIGHEST_VALUE' then t.awarded_value end desc nulls last,
      case when v_batch.assignment_order = 'LOWEST_VALUE' then t.awarded_value end asc nulls last,
      case when v_batch.assignment_order = 'RANDOM' then random() end,
      t.id
    limit least(p_chunk_size::bigint, greatest(v_batch.total_tenders - v_batch.completed_tenders, 0))
    for update skip locked
  ), candidates as (
    select row_number() over (order by tender_id) seq,
      tender_id, old_user from locked_candidates
  ), pool as (
    select p.id, count(t.id)::bigint workload,
      row_number() over (order by p.id) - 1 rr
    from public.profiles p
    left join public.tenders t on t.assigned_to = p.id and t.deleted_at is null
    where p.id = any(v_batch.selected_users) and p.is_active and p.role in ('USER','MANAGER')
    group by p.id
  ), slots as (
    select p.id, row_number() over (order by p.workload + gs.n, p.id) seq
    from pool p cross join lateral generate_series(1, p_chunk_size) gs(n)
    order by p.workload + gs.n, p.id limit p_chunk_size
  ), balanced as (
    select c.seq, c.tender_id, c.old_user,
      case when v_batch.algorithm = 'LEAST_LOADED' then s.id
        else v_batch.selected_users[1 + ((v_batch.completed_tenders + c.seq - 1) % cardinality(v_batch.selected_users))::int]
      end new_user
    from candidates c left join slots s on s.seq = c.seq
  ) insert into pg_temp.distribution_chunk select * from balanced;

  update public.tenders t set assigned_to = c.new_user, assigned_by = v_batch.started_by, updated_at = v_now
  from pg_temp.distribution_chunk c where t.id = c.tender_id;

  insert into public.lead_assignments(tender_id, assigned_to, assigned_by, assigned_date, remarks)
  select tender_id, new_user, v_batch.started_by, v_now, 'Automatic distribution - batch ' || p_batch_id
  from pg_temp.distribution_chunk where old_user is distinct from new_user;

  insert into public.assignment_batch_items(batch_id, tender_id, old_user, new_user, assigned_at)
  select p_batch_id, tender_id, old_user, new_user, v_now from pg_temp.distribution_chunk;

  insert into public.audit_logs(table_name, record_id, user_id, action, old_data, new_data)
  select 'tenders', tender_id::text, v_batch.started_by, 'AUTO_ASSIGN',
    jsonb_build_object('assigned_to', old_user, 'batch_id', p_batch_id),
    jsonb_build_object('assigned_to', new_user, 'batch_id', p_batch_id)
  from pg_temp.distribution_chunk where old_user is distinct from new_user;

  select count(*) into v_count from pg_temp.distribution_chunk;
  update public.assignment_batches
  set completed_tenders = completed_tenders + v_count,
      status = case when completed_tenders + v_count >= total_tenders or v_count = 0 then 'COMPLETED' else 'RUNNING' end,
      completed_at = case when completed_tenders + v_count >= total_tenders or v_count = 0 then clock_timestamp() else null end,
      duration_ms = case when completed_tenders + v_count >= total_tenders or v_count = 0
        then floor(extract(epoch from (clock_timestamp() - started_at)) * 1000)::bigint else null end
  where id = p_batch_id returning * into v_batch;

  if v_batch.status = 'COMPLETED' then
    insert into public.audit_logs(table_name, record_id, user_id, action, new_data)
    values ('assignment_batches', v_batch.id::text, v_batch.started_by, 'AUTO_ASSIGNMENT_BATCH_COMPLETED', to_jsonb(v_batch));
  end if;
  return v_batch;
end;
$$;

create or replace function public.lead_distribution_analytics()
returns jsonb language sql security definer set search_path = public as $$
  with permitted as (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
  select jsonb_build_object(
    'today', count(*) filter (where assigned_at >= current_date),
    'yesterday', count(*) filter (where assigned_at >= current_date - interval '1 day' and assigned_at < current_date),
    'last7Days', count(*) filter (where assigned_at >= current_date - interval '6 days'),
    'lastBatch', (select to_jsonb(b) from public.assignment_batches b cross join permitted where b.status = 'COMPLETED' order by b.completed_at desc nulls last limit 1)
  ) from public.assignment_batch_items cross join permitted;
$$;

revoke all on function public.lead_distribution_pool() from public;
revoke all on function public.preview_lead_distribution(text,text,text,bigint,uuid[]) from public;
revoke all on function public.create_assignment_batch(text,text,text,bigint,uuid[]) from public;
revoke all on function public.process_assignment_batch(uuid,integer) from public;
revoke all on function public.lead_distribution_analytics() from public;
grant execute on function public.lead_distribution_pool() to authenticated;
grant execute on function public.preview_lead_distribution(text,text,text,bigint,uuid[]) to authenticated;
grant execute on function public.create_assignment_batch(text,text,text,bigint,uuid[]) to authenticated;
grant execute on function public.process_assignment_batch(uuid,integer) to authenticated;
grant execute on function public.lead_distribution_analytics() to authenticated;
