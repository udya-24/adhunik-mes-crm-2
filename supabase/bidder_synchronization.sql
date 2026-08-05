-- Bidder synchronization engine (additive migration).
-- Run after bidder_assignments.sql and lead_pipeline_upgrade.sql.

create or replace function public.preview_bidder_synchronization(
  p_scope text,
  p_rule_id uuid default null,
  p_bidder_name text default null,
  p_assigned_user uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role::text = 'ADMIN'
  ) then
    raise exception 'Only administrators can synchronize bidder assignments';
  end if;
  if p_scope not in ('FUTURE_ONLY', 'FUTURE_AND_UNASSIGNED', 'FUTURE_AND_ALL') then
    raise exception 'Invalid bidder synchronization scope';
  end if;

  with rules as (
    select ba.id, ba.bidder_name, ba.assigned_user
    from public.bidder_assignments ba
    where ba.is_active
      and (p_rule_id is null or ba.id = p_rule_id)
      and p_bidder_name is null
    union all
    select null::uuid, btrim(p_bidder_name), p_assigned_user
    where p_bidder_name is not null and nullif(btrim(p_bidder_name), '') is not null and p_assigned_user is not null
  ), details as (
    select r.id as rule_id, r.bidder_name, r.assigned_user,
      coalesce(np.full_name, np.email, r.assigned_user::text) as new_owner,
      count(t.id)::integer as matching_tenders,
      count(t.id) filter (where t.assigned_to = r.assigned_user)::integer as already_assigned,
      count(t.id) filter (where t.assigned_to is null)::integer as unassigned,
      count(t.id) filter (where t.assigned_to is not null
        and t.assigned_to is distinct from r.assigned_user
        and p_scope = 'FUTURE_AND_ALL')::integer as will_be_reassigned,
      count(t.id) filter (where t.assigned_to is distinct from r.assigned_user
        and p_scope <> 'FUTURE_ONLY'
        and (p_scope = 'FUTURE_AND_ALL' or t.assigned_to is null))::integer as will_change,
      case
        when count(t.id) = 0 then 'None'
        when count(distinct t.assigned_to) filter (where t.assigned_to is not null) = 0 then 'Unassigned'
        when count(distinct t.assigned_to) filter (where t.assigned_to is not null) > 1
          or (count(t.id) filter (where t.assigned_to is null) > 0 and count(t.id) filter (where t.assigned_to is not null) > 0)
          then 'Multiple owners'
        else coalesce(max(coalesce(cp.full_name, cp.email)), 'Unassigned')
      end as current_owner
    from rules r
    left join public.profiles np on np.id = r.assigned_user
    left join public.tenders t on lower(btrim(t.bidder_name)) = lower(btrim(r.bidder_name))
      and t.is_deleted = false and t.deleted_at is null
    left join public.profiles cp on cp.id = t.assigned_to
    group by r.id, r.bidder_name, r.assigned_user, np.full_name, np.email
  )
  select jsonb_build_object(
    'scope', p_scope,
    'rulesProcessed', count(*),
    'matchingTenders', coalesce(sum(matching_tenders), 0),
    'alreadyAssigned', coalesce(sum(already_assigned), 0),
    'unassigned', coalesce(sum(unassigned), 0),
    'willBeReassigned', coalesce(sum(will_be_reassigned), 0),
    'willBeUpdated', coalesce(sum(will_change), 0),
    'willChange', coalesce(sum(will_change), 0),
    'skipped', coalesce(sum(matching_tenders - will_change), 0),
    'rows', coalesce(jsonb_agg(to_jsonb(details) order by bidder_name), '[]'::jsonb)
  ) into v_result from details;

  return v_result;
end;
$$;

create or replace function public.synchronize_bidder_assignments(
  p_scope text,
  p_rule_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_actor uuid := auth.uid();
  v_rules integer := 0;
  v_matching integer := 0;
  v_updated integer := 0;
  v_status_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role::text = 'ADMIN'
  ) then
    raise exception 'Only administrators can synchronize bidder assignments';
  end if;
  if p_scope not in ('FUTURE_ONLY', 'FUTURE_AND_UNASSIGNED', 'FUTURE_AND_ALL') then
    raise exception 'Invalid bidder synchronization scope';
  end if;

  -- Prevent overlapping runs from selecting the same tender and duplicating history.
  perform pg_advisory_xact_lock(hashtext('bidder_synchronization'));

  select count(*) into v_rules from public.bidder_assignments
  where is_active and (p_rule_id is null or id = p_rule_id);

  select count(*) into v_matching
  from public.tenders t
  join public.bidder_assignments ba on ba.is_active
    and lower(btrim(ba.bidder_name)) = lower(btrim(t.bidder_name))
    and (p_rule_id is null or ba.id = p_rule_id)
  where t.is_deleted = false and t.deleted_at is null;

  if p_scope <> 'FUTURE_ONLY' then
    create temporary table bidder_sync_changes on commit drop as
    select t.id as tender_id, t.assigned_to as old_user, ba.assigned_user as new_user,
      ba.id as rule_id, ba.bidder_name
    from public.tenders t
    join public.bidder_assignments ba on ba.is_active
      and lower(btrim(ba.bidder_name)) = lower(btrim(t.bidder_name))
      and (p_rule_id is null or ba.id = p_rule_id)
    where t.is_deleted = false and t.deleted_at is null
      and t.assigned_to is distinct from ba.assigned_user
      and (p_scope = 'FUTURE_AND_ALL' or t.assigned_to is null);

    select count(*) into v_updated from bidder_sync_changes;

    update public.tenders t
    set assigned_to = c.new_user, assigned_by = v_actor, updated_at = now()
    from bidder_sync_changes c where t.id = c.tender_id;

    insert into public.lead_assignments(tender_id, assigned_to, assigned_by, assigned_date, remarks)
    select tender_id, new_user, v_actor, now(), 'Bidder synchronization: ' || bidder_name
    from bidder_sync_changes;

    insert into public.lead_activities(tender_id, user_id, activity_type, activity_notes)
    select tender_id, v_actor, 'BIDDER_SYNCHRONIZED', 'Assigned to bidder owner for ' || bidder_name
    from bidder_sync_changes;

    if to_regclass('public.lead_status_history') is not null then
      select id into v_status_id from public.lead_status_master where status_name = 'New Lead' limit 1;
      execute 'insert into public.lead_status_history(tender_id,status_id,updated_by,remarks)
        select c.tender_id,
          coalesce((select h.status_id from public.lead_status_history h
            where h.tender_id = c.tender_id order by h.created_at desc limit 1), $1),
          $2, ''Bidder synchronization: '' || c.bidder_name
        from bidder_sync_changes c
        where coalesce((select h.status_id from public.lead_status_history h
          where h.tender_id = c.tender_id order by h.created_at desc limit 1), $1) is not null'
      using v_status_id, v_actor;
    end if;

    insert into public.audit_logs(table_name, record_id, user_id, action, old_data, new_data)
    select 'tenders', tender_id::text, v_actor, 'BIDDER_SYNCHRONIZATION_APPLIED',
      jsonb_build_object('assigned_to', old_user),
      jsonb_build_object('assigned_to', new_user, 'bidder_assignment_id', rule_id, 'scope', p_scope)
    from bidder_sync_changes;
  end if;

  insert into public.audit_logs(table_name, record_id, user_id, action, new_data)
  values ('bidder_assignments', coalesce(p_rule_id::text, 'ALL'), v_actor, 'BIDDER_SYNCHRONIZATION_COMPLETED',
    jsonb_build_object('scope', p_scope, 'rules_processed', v_rules, 'matching_tenders', v_matching,
      'updated', v_updated, 'skipped', v_matching - v_updated,
      'duration_ms', floor(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::bigint));

  return jsonb_build_object(
    'rulesProcessed', v_rules, 'matchingTenders', v_matching, 'updated', v_updated,
    'skipped', v_matching - v_updated, 'errors', 0,
    'durationMs', floor(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)::bigint
  );
end;
$$;

revoke all on function public.preview_bidder_synchronization(text,uuid,text,uuid) from public;
revoke all on function public.synchronize_bidder_assignments(text,uuid) from public;
grant execute on function public.preview_bidder_synchronization(text,uuid,text,uuid) to authenticated;
grant execute on function public.synchronize_bidder_assignments(text,uuid) to authenticated;
