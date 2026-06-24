-- Adds persisted GST values for the quotation commercial summary.
alter table public.quotations
  add column if not exists gst_percentage numeric(7,2) not null default 0,
  add column if not exists gst_amount numeric(15,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotations_gst_percentage_nonnegative'
      and conrelid = 'public.quotations'::regclass
  ) then
    alter table public.quotations
      add constraint quotations_gst_percentage_nonnegative
      check (gst_percentage >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotations_gst_amount_nonnegative'
      and conrelid = 'public.quotations'::regclass
  ) then
    alter table public.quotations
      add constraint quotations_gst_amount_nonnegative
      check (gst_amount >= 0);
  end if;
end
$$;
