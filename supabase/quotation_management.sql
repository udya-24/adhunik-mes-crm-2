-- Quotation Management module. Additive migration; existing tender objects are untouched.
alter table public.profiles
  add column if not exists can_access_quotations boolean not null default false;

do $$ begin
  create type quotation_status as enum ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_no text not null unique,
  quotation_date date not null default current_date,
  contract_name text,
  customer_name text not null,
  address text,
  gst_number text,
  contact_person text,
  mobile_number text,
  email text,
  project_name text,
  tender_reference text,
  header_image_url text,
  status quotation_status not null default 'DRAFT',
  gst_percentage numeric(7,2) not null default 0 check (gst_percentage >= 0),
  gst_amount numeric(15,2) not null default 0 check (gst_amount >= 0),
  grand_total numeric(15,2) not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  line_no integer not null,
  item_description text not null,
  quantity numeric(15,3) not null default 0 check (quantity >= 0),
  unit text not null default 'Nos',
  unit_price numeric(15,2) not null default 0 check (unit_price >= 0),
  total_price numeric(15,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quotation_terms (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  term_key text not null,
  term_value text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quotations_created_by_idx on public.quotations(created_by);
create index if not exists quotations_date_idx on public.quotations(quotation_date desc);
create index if not exists quotation_items_quotation_idx on public.quotation_items(quotation_id, line_no);
create index if not exists quotation_terms_quotation_idx on public.quotation_terms(quotation_id, display_order);

drop trigger if exists quotations_set_updated_at on public.quotations;
create trigger quotations_set_updated_at before update on public.quotations
for each row execute function public.set_updated_at();

alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_terms enable row level security;

update storage.buckets
set public = true
where id = 'quotations';

drop policy if exists "quotation_select_scope" on public.quotations;
create policy "quotation_select_scope" on public.quotations for select using (
  public.current_profile_role() in ('ADMIN','MANAGER')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true and p.can_access_quotations = true
  )
);

drop policy if exists "quotation_insert_scope" on public.quotations;
create policy "quotation_insert_scope" on public.quotations for insert with check (
  created_by = auth.uid() and (
    public.current_profile_role() in ('ADMIN','MANAGER')
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true and p.can_access_quotations = true
    )
  )
);

drop policy if exists "quotation_update_scope" on public.quotations;
create policy "quotation_update_scope" on public.quotations for update
using (
  public.current_profile_role() in ('ADMIN','MANAGER')
  or (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true and p.can_access_quotations = true
    )
  )
)
with check (
  public.current_profile_role() in ('ADMIN','MANAGER')
  or created_by = auth.uid()
);

drop policy if exists "quotation_delete_scope" on public.quotations;
create policy "quotation_delete_scope" on public.quotations for delete
using (public.current_profile_role() = 'ADMIN');

drop policy if exists "quotation_items_scope" on public.quotation_items;
create policy "quotation_items_scope" on public.quotation_items for all
using (exists (select 1 from public.quotations q where q.id = quotation_id))
with check (exists (select 1 from public.quotations q where q.id = quotation_id));

drop policy if exists "quotation_terms_scope" on public.quotation_terms;
create policy "quotation_terms_scope" on public.quotation_terms for all
using (exists (select 1 from public.quotations q where q.id = quotation_id))
with check (exists (select 1 from public.quotations q where q.id = quotation_id));
