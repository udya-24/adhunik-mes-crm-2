alter table public.tenders
add column if not exists is_deleted boolean not null default false,
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists tenders_is_deleted_idx on public.tenders(is_deleted);

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

drop trigger if exists tenders_admin_soft_delete_guard on public.tenders;
create trigger tenders_admin_soft_delete_guard before update on public.tenders
for each row execute function public.prevent_non_admin_tender_soft_delete();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_logs'
      and policyname = 'audit_admin_insert'
  ) then
    create policy "audit_admin_insert" on public.audit_logs for insert
    with check (public.current_profile_role() = 'ADMIN');
  end if;
end
$$;
