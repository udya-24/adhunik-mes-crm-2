-- IMS Master module for Adhunik MES CRM.
-- Apply after the core auth/profile schema is available.

create extension if not exists pg_trgm;

create table if not exists public.ims_master (
  id uuid primary key default gen_random_uuid(),
  item_code text,
  item_category text not null,
  item_category_key text generated always as (lower(regexp_replace(btrim(item_category), '\s+', ' ', 'g'))) stored,
  item_description text not null,
  item_description_key text generated always as (lower(regexp_replace(btrim(item_description), '\s+', ' ', 'g'))) stored,
  make text,
  model text,
  unit text,
  hsn_code text,
  remarks text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ims_master_category_description_unique unique (item_category_key, item_description_key),
  constraint ims_master_category_required check (length(btrim(item_category)) > 0),
  constraint ims_master_description_required check (length(btrim(item_description)) > 0)
);

create table if not exists public.ims_import_history (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  imported_by uuid references auth.users(id) on delete set null,
  rows_imported integer not null default 0 check (rows_imported >= 0),
  rows_updated integer not null default 0 check (rows_updated >= 0),
  rows_skipped integer not null default 0 check (rows_skipped >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ims_master_active_category_idx on public.ims_master (is_active, item_category);
create index if not exists ims_master_updated_idx on public.ims_master (updated_at desc);
create index if not exists ims_master_item_code_idx on public.ims_master (item_code) where item_code is not null;
create index if not exists ims_master_description_trgm_idx on public.ims_master using gin (item_description gin_trgm_ops);
create index if not exists ims_master_category_trgm_idx on public.ims_master using gin (item_category gin_trgm_ops);
create index if not exists ims_master_make_trgm_idx on public.ims_master using gin (make gin_trgm_ops);
create index if not exists ims_master_model_trgm_idx on public.ims_master using gin (model gin_trgm_ops);
create index if not exists ims_import_history_created_idx on public.ims_import_history (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ims_master_set_updated_at on public.ims_master;
create trigger ims_master_set_updated_at
before update on public.ims_master
for each row execute function public.set_updated_at();

alter table public.ims_master enable row level security;
alter table public.ims_import_history enable row level security;

drop policy if exists "IMS master read for active users" on public.ims_master;
create policy "IMS master read for active users"
on public.ims_master
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('ADMIN', 'MANAGER', 'USER')
  )
);

drop policy if exists "IMS master admin insert" on public.ims_master;
create policy "IMS master admin insert"
on public.ims_master
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'ADMIN'
  )
);

drop policy if exists "IMS master admin update" on public.ims_master;
create policy "IMS master admin update"
on public.ims_master
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'ADMIN'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'ADMIN'
  )
);

drop policy if exists "IMS import history read for active users" on public.ims_import_history;
create policy "IMS import history read for active users"
on public.ims_import_history
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('ADMIN', 'MANAGER', 'USER')
  )
);

drop policy if exists "IMS import history admin insert" on public.ims_import_history;
create policy "IMS import history admin insert"
on public.ims_import_history
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.role = 'ADMIN'
  )
);

alter table if exists public.quotation_items
  add column if not exists ims_master_id uuid references public.ims_master(id) on delete set null,
  add column if not exists item_category text,
  add column if not exists make text,
  add column if not exists model text;

alter table if exists public.proforma_invoice_items
  add column if not exists ims_master_id uuid references public.ims_master(id) on delete set null,
  add column if not exists item_category text,
  add column if not exists make text;

create index if not exists quotation_items_ims_master_idx on public.quotation_items (ims_master_id);
create index if not exists proforma_invoice_items_ims_master_idx on public.proforma_invoice_items (ims_master_id);
