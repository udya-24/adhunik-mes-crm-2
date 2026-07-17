-- Communication Center enterprise UI upgrade. Apply after communication_center.sql.
alter table public.communication_accounts add column if not exists last_sync_at timestamptz;
alter table public.communication_accounts add column if not exists daily_limit integer not null default 500 check (daily_limit > 0);
alter table public.communication_accounts add column if not exists signature text;
alter table public.communication_templates add column if not exists updated_at timestamptz not null default now();
alter table public.communication_templates drop constraint if exists communication_templates_category_check;
alter table public.communication_templates add constraint communication_templates_category_check check (category in ('QUOTATION','PI','PROFORMA_INVOICE','PURCHASE_ORDER','TAX_INVOICE','REMINDER','FOLLOW_UP','WELCOME','COMPLAINT','CUSTOM'));
alter table public.communication_drafts add column if not exists to_address text;
alter table public.communication_drafts add column if not exists cc text[] not null default '{}';
alter table public.communication_drafts add column if not exists bcc text[] not null default '{}';
alter table public.communication_drafts add column if not exists attachment_count integer not null default 0 check (attachment_count >= 0);
alter table public.communications add column if not exists template_id uuid references public.communication_templates(id) on delete set null;
alter table public.communications add column if not exists scheduled_at timestamptz;
alter table public.communication_attachments alter column communication_id drop not null;
alter table public.communication_attachments add column if not exists folder text not null default 'COMPANY_DOCUMENTS';
alter table public.communication_attachments add column if not exists file_type text;
alter table public.communication_attachments add column if not exists created_by uuid references public.profiles(id);
create index if not exists communications_template_idx on public.communications(template_id);
create index if not exists communications_scheduled_idx on public.communications(scheduled_at) where status='QUEUED';
create index if not exists communication_attachments_folder_idx on public.communication_attachments(folder, created_at desc);
drop trigger if exists communication_templates_updated_at on public.communication_templates;
create trigger communication_templates_updated_at before update on public.communication_templates for each row execute function public.communication_set_updated_at();
drop policy if exists communication_attachments_library_insert on public.communication_attachments;
create policy communication_attachments_library_insert on public.communication_attachments for insert with check (
  created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
);
drop policy if exists communication_attachments_library_update on public.communication_attachments;
create policy communication_attachments_library_update on public.communication_attachments for update using (
  created_by=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER'))
) with check (created_by=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER')));
drop policy if exists communication_attachments_library_delete on public.communication_attachments;
create policy communication_attachments_library_delete on public.communication_attachments for delete using (
  created_by=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER'))
);
