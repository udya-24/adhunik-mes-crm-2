alter table public.quotations
  add column if not exists shipping_address text;

alter table public.proforma_invoices
  add column if not exists shipping_address text;
