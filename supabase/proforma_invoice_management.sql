-- Proforma Invoice module. Independent from quotations.

alter table public.profiles
  add column if not exists can_access_pi boolean not null default false;

create table if not exists public.proforma_invoices (
  id uuid primary key default gen_random_uuid(),
  pi_no text not null unique,
  pi_date date not null default current_date,
  our_ref_no text,
  dp_code text,
  mobile_no text,
  indentor_name text not null,
  indentor_address text,
  email text,
  gstin text,
  po_no text,
  po_date date,
  project text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SENT', 'APPROVED', 'CANCELLED')),
  gst_percentage numeric(8,2) not null default 0 check (gst_percentage >= 0),
  gst_amount numeric(14,2) not null default 0 check (gst_amount >= 0),
  grand_total numeric(14,2) not null default 0 check (grand_total >= 0),
  signature_designation text,
  signature_email text,
  signature_mobile text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proforma_invoice_items (
  id uuid primary key default gen_random_uuid(),
  proforma_invoice_id uuid not null references public.proforma_invoices(id) on delete cascade,
  line_no integer not null,
  item_description text not null,
  model_type text,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  total_price numeric(14,2) not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.proforma_invoice_terms (
  id uuid primary key default gen_random_uuid(),
  proforma_invoice_id uuid not null references public.proforma_invoices(id) on delete cascade,
  term_key text not null,
  term_value text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists proforma_invoices_created_by_idx on public.proforma_invoices(created_by);
create index if not exists proforma_invoices_pi_date_idx on public.proforma_invoices(pi_date desc);
create index if not exists proforma_invoices_status_idx on public.proforma_invoices(status);
create index if not exists proforma_invoice_items_invoice_idx on public.proforma_invoice_items(proforma_invoice_id, line_no);
create index if not exists proforma_invoice_terms_invoice_idx on public.proforma_invoice_terms(proforma_invoice_id, display_order);

create or replace function public.set_proforma_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_proforma_invoices_updated_at on public.proforma_invoices;
create trigger set_proforma_invoices_updated_at
before update on public.proforma_invoices
for each row
execute function public.set_proforma_invoices_updated_at();

alter table public.proforma_invoices enable row level security;
alter table public.proforma_invoice_items enable row level security;
alter table public.proforma_invoice_terms enable row level security;

drop policy if exists "proforma_invoice_select_scope" on public.proforma_invoices;
create policy "proforma_invoice_select_scope" on public.proforma_invoices for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (p.role in ('ADMIN', 'MANAGER') or p.can_access_pi = true)
  )
);

drop policy if exists "proforma_invoice_insert_scope" on public.proforma_invoices;
create policy "proforma_invoice_insert_scope" on public.proforma_invoices for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (p.role in ('ADMIN', 'MANAGER') or p.can_access_pi = true)
  )
);

drop policy if exists "proforma_invoice_update_scope" on public.proforma_invoices;
create policy "proforma_invoice_update_scope" on public.proforma_invoices for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (p.role in ('ADMIN', 'MANAGER') or (p.can_access_pi = true and created_by = auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (p.role in ('ADMIN', 'MANAGER') or (p.can_access_pi = true and created_by = auth.uid()))
  )
);

drop policy if exists "proforma_invoice_delete_scope" on public.proforma_invoices;
create policy "proforma_invoice_delete_scope" on public.proforma_invoices for delete using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('ADMIN', 'MANAGER')
  )
);

drop policy if exists "proforma_invoice_items_scope" on public.proforma_invoice_items;
create policy "proforma_invoice_items_scope" on public.proforma_invoice_items for all
using (exists (select 1 from public.proforma_invoices pi where pi.id = proforma_invoice_id))
with check (exists (select 1 from public.proforma_invoices pi where pi.id = proforma_invoice_id));

drop policy if exists "proforma_invoice_terms_scope" on public.proforma_invoice_terms;
create policy "proforma_invoice_terms_scope" on public.proforma_invoice_terms for all
using (exists (select 1 from public.proforma_invoices pi where pi.id = proforma_invoice_id))
with check (exists (select 1 from public.proforma_invoices pi where pi.id = proforma_invoice_id));
