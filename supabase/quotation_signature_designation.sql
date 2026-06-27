-- Adds a manually entered designation for quotation signatures.
-- This is intentionally not derived from user roles.
alter table public.quotations
  add column if not exists signature_designation text;
