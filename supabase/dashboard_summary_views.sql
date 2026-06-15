drop view if exists vw_operational_summary;

create view vw_operational_summary
with (security_invoker = true)
as
select
  case
    when assigned_to is null then 'OPEN_POOL'
    else 'ASSIGNED'
  end as status,
  count(*) as count
from tenders
where deleted_at is null
group by status;

drop view if exists vw_pipeline_summary;

create view vw_pipeline_summary
with (security_invoker = true)
as
select
  coalesce(lead_status, 'NEW') as stage,
  count(*) as count
from tenders
where deleted_at is null
group by coalesce(lead_status, 'NEW');
