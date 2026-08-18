-- Enterprise analytics: server-side filtering, aggregation, sorting and paging.
-- SECURITY INVOKER is intentional: existing tender RLS remains authoritative.
create index if not exists tenders_analytics_active_idx on public.tenders (contract_date, assigned_to) where not is_deleted and deleted_at is null;
create index if not exists tenders_analytics_bidder_idx on public.tenders (lower(btrim(bidder_name))) where not is_deleted and deleted_at is null;
create index if not exists tenders_analytics_ge_idx on public.tenders (lower(btrim(ge))) where not is_deleted and deleted_at is null;
create index if not exists tenders_analytics_cwe_idx on public.tenders (lower(btrim(cwe))) where not is_deleted and deleted_at is null;
create index if not exists tenders_analytics_org_idx on public.tenders (lower(btrim(organisation_chain))) where not is_deleted and deleted_at is null;

create or replace function public.analytics_table(
  p_entity text, p_filters jsonb default '{}'::jsonb, p_search text default '',
  p_sorts jsonb default '[{"key":"total_tenders","direction":"desc"}]'::jsonb,
  p_page integer default 1, p_page_size integer default 25, p_export boolean default false
) returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare v_group text; v_sql text; v_result jsonb; v_limit integer;
begin
  if p_entity not in ('bidder','contractor','ge','cwe') then raise exception 'Invalid analytics entity'; end if;
  v_group := case when p_entity in ('bidder','contractor') then 'bidder_name' else p_entity end;
  v_limit := case when p_export then 10000 else least(greatest(p_page_size,1),100) end;
  v_sql := format($q$
    with filtered as (
      select t.*, p.full_name assigned_user_name
      from tenders t left join profiles p on p.id=t.assigned_to
      left join profiles m on m.id=p.manager_id
      where not t.is_deleted and t.deleted_at is null
        and ($1->>'dateFrom' is null or coalesce(t.contract_date,t.created_at::date) >= ($1->>'dateFrom')::date)
        and ($1->>'dateTo' is null or coalesce(t.contract_date,t.created_at::date) <= ($1->>'dateTo')::date)
        and ($1->>'user' is null or t.assigned_to::text=$1->>'user')
        and ($1->>'manager' is null or p.manager_id::text=$1->>'manager')
        and ($1->>'bidder' is null or t.bidder_name=$1->>'bidder')
        and ($1->>'ge' is null or t.ge=$1->>'ge') and ($1->>'cwe' is null or t.cwe=$1->>'cwe')
        and ($1->>'organisation' is null or t.organisation_chain=$1->>'organisation')
        and ($1->>'tenderStatus' is null or t.lead_status::text=$1->>'tenderStatus')
        and ($1->>'source' is null or t.source_type::text=$1->>'source')
        and ($1->>'leadStage' is null or (case t.lead_status
          when 'NEW' then 'New Lead' when 'CONTACTED' then 'Contacted'
          when 'FOLLOW_UP' then 'Follow Up Required' when 'QUOTATION_SENT' then 'Quotation Sent'
          when 'NEGOTIATION' then 'Price Negotiation' when 'WON' then 'Order Received'
          when 'LOST' then 'Lost To Competitor' else initcap(replace(t.lead_status::text,'_',' ')) end)=$1->>'leadStage')
    ), grouped as (
      select coalesce(nullif(btrim(%1$I),''),'Unknown') name, count(*)::int total_tenders,
        coalesce(sum(awarded_value),0)::numeric awarded_value, coalesce(sum(our_value),0)::numeric our_value,
        count(*) filter(where lead_status='WON')::int won, count(*) filter(where lead_status='LOST')::int lost,
        count(*) filter(where lead_status not in ('WON','LOST'))::int pending,
        count(*) filter(where lead_status='NEW')::int new_leads,
        coalesce(avg(awarded_value),0)::numeric average_tender_value,
        coalesce(max(awarded_value),0)::numeric highest_tender,
        string_agg(distinct assigned_user_name, ', ' order by assigned_user_name) assigned_users,
        max(coalesce(contract_date,created_at::date)) last_tender_date,
        max(contact_number_1) contact,
        round(100.0*count(*) filter(where lead_status='WON')/nullif(count(*) filter(where lead_status in ('WON','LOST')),0),2) conversion_percent
      from filtered group by coalesce(nullif(btrim(%1$I),''),'Unknown')
    ), searched as (select * from grouped where $2='' or name ilike '%%'||$2||'%%'),
    numbered as (select *, count(*) over() total_count from searched)
    select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(x)-'total_count'),'[]'::jsonb),'total',coalesce(max(total_count),0))
    from (select * from numbered order by %2$s limit $3 offset $4) x
  $q$, v_group,
    coalesce((select string_agg(format('%I %s nulls last',
      case value->>'key' when 'name' then 'name' when 'total_tenders' then 'total_tenders' when 'awarded_value' then 'awarded_value' when 'our_value' then 'our_value' when 'won' then 'won' when 'lost' then 'lost' when 'pending' then 'pending' when 'new_leads' then 'new_leads' when 'average_tender_value' then 'average_tender_value' when 'highest_tender' then 'highest_tender' when 'assigned_users' then 'assigned_users' when 'last_tender_date' then 'last_tender_date' when 'contact' then 'contact' when 'conversion_percent' then 'conversion_percent' else 'total_tenders' end,
      case when value->>'direction'='asc' then 'asc' else 'desc' end),', ') from jsonb_array_elements(p_sorts)), 'total_tenders desc'));
  execute v_sql into v_result using p_filters,coalesce(p_search,''),v_limit,case when p_export then 0 else (greatest(p_page,1)-1)*v_limit end;
  return v_result;
end $$;

create or replace function public.analytics_filter_options()
returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
  'users',(select coalesce(jsonb_agg(jsonb_build_object('value',id,'label',coalesce(full_name,email)) order by coalesce(full_name,email)),'[]') from profiles where is_active),
  'managers',(select coalesce(jsonb_agg(jsonb_build_object('value',id,'label',coalesce(full_name,email)) order by coalesce(full_name,email)),'[]') from profiles where is_active and role in ('ADMIN','MANAGER')),
  'bidders',(select coalesce(jsonb_agg(x),'[]') from (select distinct bidder_name x from tenders where not is_deleted and bidder_name is not null order by 1) s),
  'ges',(select coalesce(jsonb_agg(x),'[]') from (select distinct ge x from tenders where not is_deleted and ge is not null order by 1) s),
  'cwes',(select coalesce(jsonb_agg(x),'[]') from (select distinct cwe x from tenders where not is_deleted and cwe is not null order by 1) s),
  'organisations',(select coalesce(jsonb_agg(x),'[]') from (select distinct organisation_chain x from tenders where not is_deleted and organisation_chain is not null order by 1) s),
  'leadStages',(select coalesce(jsonb_agg(status_name order by sort_order),'[]') from lead_status_master where is_active)
 )
$$;

create or replace function public.analytics_entity_detail(p_entity text,p_name text,p_filters jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker set search_path=public as $$
 with e as (
   select t.*,p.full_name assigned_user_name
   from tenders t left join profiles p on p.id=t.assigned_to
   where not t.is_deleted and t.deleted_at is null
   -- Grouped rows have no entity id. Match the selected grouping value against
   -- the actual field, using the same normalization as the summary grouping.
   and case p_entity
     when 'bidder' then lower(coalesce(nullif(btrim(t.bidder_name),''),'Unknown'))=lower(btrim(p_name))
     when 'contractor' then lower(coalesce(nullif(btrim(t.bidder_name),''),'Unknown'))=lower(btrim(p_name))
     when 'ge' then lower(coalesce(nullif(btrim(t.ge),''),'Unknown'))=lower(btrim(p_name))
     when 'cwe' then lower(coalesce(nullif(btrim(t.cwe),''),'Unknown'))=lower(btrim(p_name))
     else false end
   and (p_filters->>'dateFrom' is null or coalesce(t.contract_date,t.created_at::date)>=(p_filters->>'dateFrom')::date)
   and (p_filters->>'dateTo' is null or coalesce(t.contract_date,t.created_at::date)<=(p_filters->>'dateTo')::date)
   and (p_filters->>'user' is null or t.assigned_to::text=p_filters->>'user')
   and (p_filters->>'manager' is null or p.manager_id::text=p_filters->>'manager')
   and (p_filters->>'bidder' is null or lower(btrim(t.bidder_name))=lower(btrim(p_filters->>'bidder')))
   and (p_filters->>'ge' is null or lower(btrim(t.ge))=lower(btrim(p_filters->>'ge')))
   and (p_filters->>'cwe' is null or lower(btrim(t.cwe))=lower(btrim(p_filters->>'cwe')))
   and (p_filters->>'organisation' is null or t.organisation_chain=p_filters->>'organisation')
   and (p_filters->>'tenderStatus' is null or t.lead_status::text=p_filters->>'tenderStatus')
   and (p_filters->>'source' is null or t.source_type::text=p_filters->>'source')
 ),
 monthly_trend as(select to_char(date_trunc('month',coalesce(contract_date,created_at::date)::timestamp),'YYYY-MM') trend_period,count(*) count,coalesce(sum(our_value),0) our_value from e group by date_trunc('month',coalesce(contract_date,created_at::date)::timestamp) order by date_trunc('month',coalesce(contract_date,created_at::date)::timestamp)),
 history as(select jsonb_build_object('id',id,'tenderId',tender_id,'title',tender_title,'date',coalesce(contract_date,created_at::date),'status',lead_status,'awardedValue',coalesce(awarded_value,0),'ourValue',coalesce(our_value,0),'user',assigned_user_name) row from e order by coalesce(contract_date,created_at::date) desc limit 500),
 quote_rows as(select jsonb_build_object('id',q.id,'number',q.quotation_no,'date',q.quotation_date,'status',q.status,'value',q.grand_total) row from quotations q where exists(select 1 from e where q.tender_reference in (e.tender_id,e.tender_ref_no))),
 pi_rows as(select jsonb_build_object('id',pi.id,'number',pi.pi_no,'date',pi.pi_date,'status',pi.status,'value',pi.grand_total) row from proforma_invoices pi where exists(select 1 from e where pi.our_ref_no in (e.tender_id,e.tender_ref_no))),
 comm_rows as(select jsonb_build_object('id',c.id,'channel',c.channel,'subject',c.subject,'status',c.status,'date',c.created_at) row from communications c where exists(select 1 from e where c.related_record_id=e.id)),
 timeline_rows as(select jsonb_build_object('id',a.id,'type',a.activity_type,'notes',a.activity_notes,'date',a.created_at) row from lead_activities a where exists(select 1 from e where e.id=a.tender_id) order by a.created_at desc limit 1000)
 select jsonb_build_object(
   'metrics',(select jsonb_build_object('totalTenders',count(*),'awardedValue',coalesce(sum(awarded_value),0),'ourValue',coalesce(sum(our_value),0),'won',count(*) filter(where lead_status='WON'),'lost',count(*) filter(where lead_status='LOST')) from e),
   'history',(select coalesce(jsonb_agg(row),'[]') from history),
   'monthlyTrend',(select coalesce(jsonb_agg(to_jsonb(monthly_trend)),'[]') from monthly_trend),
   'assignedUsers',(select coalesce(jsonb_agg(distinct assigned_user_name),'[]') from e where assigned_user_name is not null),
   'quotations',(select coalesce(jsonb_agg(row),'[]') from quote_rows),
   'proformaInvoices',(select coalesce(jsonb_agg(row),'[]') from pi_rows),
   'communications',(select coalesce(jsonb_agg(row),'[]') from comm_rows),
   'timeline',(select coalesce(jsonb_agg(row),'[]') from timeline_rows))
$$;

grant execute on function public.analytics_table(text,jsonb,text,jsonb,integer,integer,boolean) to authenticated;
grant execute on function public.analytics_filter_options() to authenticated;
grant execute on function public.analytics_entity_detail(text,text,jsonb) to authenticated;

-- Complete 360-degree grouped drill-down. No grouped-row UUID is accepted:
-- p_group_value is always compared to bidder_name, ge, or cwe.
create or replace function public.analytics_entity_detail_360(p_entity text,p_group_value text,p_filters jsonb default '{}'::jsonb)
returns jsonb language sql stable security invoker set search_path=public as $$
with entity_tenders as (
  select t.*, assignee.full_name assigned_user_name, uploader.full_name uploaded_by_name,
    assigner.full_name assigned_by_name,
    (select max(f.follow_up_date) from follow_ups f where f.tender_id=t.id) last_follow_up,
    (select max(a.created_at) from lead_activities a where a.tender_id=t.id) last_activity
  from tenders t
  left join profiles assignee on assignee.id=t.assigned_to
  left join profiles uploader on uploader.id=t.uploaded_by
  left join profiles assigner on assigner.id=t.assigned_by
  where not t.is_deleted and t.deleted_at is null
    and case p_entity
      when 'bidder' then lower(coalesce(nullif(btrim(t.bidder_name),''),'Unknown'))=lower(btrim(p_group_value))
      when 'contractor' then lower(coalesce(nullif(btrim(t.bidder_name),''),'Unknown'))=lower(btrim(p_group_value))
      when 'ge' then lower(coalesce(nullif(btrim(t.ge),''),'Unknown'))=lower(btrim(p_group_value))
      when 'cwe' then lower(coalesce(nullif(btrim(t.cwe),''),'Unknown'))=lower(btrim(p_group_value))
      else false end
    and (p_filters->>'dateFrom' is null or coalesce(t.contract_date,t.created_at::date)>=(p_filters->>'dateFrom')::date)
    and (p_filters->>'dateTo' is null or coalesce(t.contract_date,t.created_at::date)<=(p_filters->>'dateTo')::date)
    and (p_filters->>'user' is null or t.assigned_to::text=p_filters->>'user')
    and (p_filters->>'bidder' is null or lower(btrim(t.bidder_name))=lower(btrim(p_filters->>'bidder')))
    and (p_filters->>'ge' is null or lower(btrim(t.ge))=lower(btrim(p_filters->>'ge')))
    and (p_filters->>'cwe' is null or lower(btrim(t.cwe))=lower(btrim(p_filters->>'cwe')))
    and (p_filters->>'organisation' is null or t.organisation_chain=p_filters->>'organisation')
    and (p_filters->>'tenderStatus' is null or t.lead_status::text=p_filters->>'tenderStatus')
    and (p_filters->>'source' is null or t.source_type::text=p_filters->>'source')
), monthly_trend as (
  select date_trunc('month',coalesce(contract_date,created_at::date)::timestamp) trend_date,
    to_char(date_trunc('month',coalesce(contract_date,created_at::date)::timestamp),'YYYY-MM') trend_period,
    count(*)::int tender_count,coalesce(sum(awarded_value),0) awarded_value,coalesce(sum(our_value),0) our_value
  from entity_tenders group by date_trunc('month',coalesce(contract_date,created_at::date)::timestamp) order by trend_date
), tender_rows as (
  select jsonb_build_object('id',id,'tenderId',tender_id,'title',tender_title,'bidNumber',bid_number,'referenceNumber',tender_ref_no,
    'bidder',bidder_name,'ge',ge,'cwe',cwe,'status',lead_status,'awardedValue',coalesce(awarded_value,0),'ourValue',coalesce(our_value,0),
    'assignedUser',assigned_user_name,'uploadedBy',uploaded_by_name,'createdDate',created_at,'lastFollowUp',last_follow_up,'lastActivity',last_activity) row
  from entity_tenders order by created_at desc
), assignment_rows as (
  select jsonb_build_object('id',la.id,'tenderId',e.tender_id,'assignedUser',au.full_name,'assignedBy',ab.full_name,'assignedDate',la.assigned_date,'remarks',la.remarks) row
  from lead_assignments la join entity_tenders e on e.id=la.tender_id left join profiles au on au.id=la.assigned_to left join profiles ab on ab.id=la.assigned_by order by la.assigned_date desc
), follow_up_rows as (
  select jsonb_build_object('id',f.id,'tenderId',e.tender_id,'user',p.full_name,'followUpDate',f.follow_up_date,'remarks',f.remarks,'status',f.status,'createdDate',f.created_at) row
  from follow_ups f join entity_tenders e on e.id=f.tender_id left join profiles p on p.id=f.user_id order by f.follow_up_date desc
), communication_rows as (
  select jsonb_build_object('id',c.id,'tenderId',e.tender_id,'channel',c.channel,'subject',c.subject,'to',c.to_address,'status',c.status,'createdDate',c.created_at,'sentDate',c.sent_at) row
  from communications c join entity_tenders e on c.related_record_id=e.id order by c.created_at desc
), quotation_rows as (
  select jsonb_build_object('id',q.id,'number',q.quotation_no,'tenderReference',q.tender_reference,'customer',q.customer_name,'date',q.quotation_date,'status',q.status,'value',q.grand_total,'url','/quotations/'||q.id) row
  from quotations q where exists(select 1 from entity_tenders e where q.tender_reference in(e.tender_id,e.tender_ref_no)) order by q.quotation_date desc
), pi_rows as (
  select jsonb_build_object('id',pi.id,'number',pi.pi_no,'reference',pi.our_ref_no,'customer',pi.indentor_name,'date',pi.pi_date,'status',pi.status,'value',pi.grand_total,'url','/proforma-invoices/'||pi.id) row
  from proforma_invoices pi where exists(select 1 from entity_tenders e where pi.our_ref_no in(e.tender_id,e.tender_ref_no)) order by pi.pi_date desc
), document_rows as (
  select jsonb_build_object('id',id::text||'-tender','tenderId',tender_id,'type','Tender Document','name',tender_document_attachment_name,'url',tender_document_url) row from entity_tenders where tender_document_url is not null
  union all select jsonb_build_object('id',id::text||'-boq','tenderId',tender_id,'type','BOQ','name',boq_attachment_name,'url',boq_attachment_url) from entity_tenders where boq_attachment_url is not null
  union all select jsonb_build_object('id',id::text||'-aoc','tenderId',tender_id,'type','AOC','name',aoc_attachment_name,'url',aoc_attachment_url) from entity_tenders where aoc_attachment_url is not null
), assignment_summary as (
  select jsonb_build_object(
    'currentAssignedUsers',coalesce(
      jsonb_agg(distinct ap.full_name) filter(where ap.full_name is not null),
      '[]'::jsonb
    ),
    'assignedBy',coalesce(
      jsonb_agg(distinct bp.full_name) filter(where bp.full_name is not null),
      '[]'::jsonb
    ),
    'latestAssignedDate',(
      select max(la.assigned_date)
      from lead_assignments la
      join entity_tenders assignment_tender on assignment_tender.id=la.tender_id
    ),
    'reassignments',greatest(
      (select count(*) from assignment_rows)
      - (select count(*) from entity_tenders),
      0
    )
  ) row
  from entity_tenders et
  left join profiles ap on ap.id=et.assigned_to
  left join profiles bp on bp.id=et.assigned_by
), user_rows as (
  select jsonb_build_object('user',coalesce(assigned_user_name,'Unassigned'),'tenderCount',count(*),'awardedValue',coalesce(sum(awarded_value),0),
    'won',count(*) filter(where lead_status='WON'),'pending',count(*) filter(where lead_status not in('WON','LOST')),'lost',count(*) filter(where lead_status='LOST'),
    'averageDealSize',coalesce(avg(awarded_value),0)) row from entity_tenders group by coalesce(assigned_user_name,'Unassigned')
)
select jsonb_build_object(
 'summary',(select jsonb_build_object('totalTenders',count(*),'awardedTenders',count(*) filter(where lead_status='WON'),'pending',count(*) filter(where lead_status not in('WON','LOST')),
   'lost',count(*) filter(where lead_status='LOST'),'newLeads',count(*) filter(where lead_status='NEW'),'cancelled',0) from entity_tenders),
 'business',(select jsonb_build_object('awardedValue',coalesce(sum(awarded_value),0),'ourValue',coalesce(sum(our_value),0),'averageTenderValue',coalesce(avg(awarded_value),0),
   'highestTender',coalesce(max(awarded_value),0),'lowestTender',coalesce(min(awarded_value),0),'winRate',round(100.0*count(*) filter(where lead_status='WON')/nullif(count(*) filter(where lead_status in('WON','LOST')),0),2)) from entity_tenders),
 'assignment',(select row from assignment_summary),
 'monthlyTrend',(select coalesce(jsonb_agg(to_jsonb(monthly_trend)-'trend_date'),'[]') from monthly_trend),
 'tenders',(select coalesce(jsonb_agg(row),'[]') from tender_rows),'assignmentHistory',(select coalesce(jsonb_agg(row),'[]') from assignment_rows),
 'followUps',(select coalesce(jsonb_agg(row),'[]') from follow_up_rows),'communications',(select coalesce(jsonb_agg(row),'[]') from communication_rows),
 'quotations',(select coalesce(jsonb_agg(row),'[]') from quotation_rows),'proformaInvoices',(select coalesce(jsonb_agg(row),'[]') from pi_rows),
 'documents',(select coalesce(jsonb_agg(row),'[]') from document_rows),'userPerformance',(select coalesce(jsonb_agg(row),'[]') from user_rows))
$$;
grant execute on function public.analytics_entity_detail_360(text,text,jsonb) to authenticated;
