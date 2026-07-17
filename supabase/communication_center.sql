-- Communication Center Phase 1
-- Provider-neutral foundation only. No OAuth/API credentials are stored here.

create table if not exists public.communication_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('GMAIL','EMAIL','WHATSAPP','SMS','NOTIFICATION')),
  display_name text not null,
  email_address text,
  is_default boolean not null default false,
  is_active boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  channel text not null check (channel in ('EMAIL','WHATSAPP','SMS','NOTIFICATION')),
  subject text,
  body text not null,
  category text not null default 'CUSTOM' check (category in ('QUOTATION','PI','REMINDER','FOLLOW_UP','CUSTOM')),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('EMAIL','WHATSAPP','SMS','NOTIFICATION')),
  status text not null default 'QUEUED' check (status in ('QUEUED','SENDING','SENT','FAILED','CANCELLED')),
  subject text,
  body text not null,
  from_account uuid references public.communication_accounts(id) on delete set null,
  to_address text not null,
  cc text[] not null default '{}',
  bcc text[] not null default '{}',
  related_module text,
  related_record_id uuid,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.communication_attachments (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications(id) on delete cascade,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.communication_drafts (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('EMAIL','WHATSAPP','SMS','NOTIFICATION')),
  subject text,
  body text not null default '',
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create unique index if not exists communication_accounts_one_default_idx on public.communication_accounts(is_default) where is_default = true;
create index if not exists communication_accounts_provider_idx on public.communication_accounts(provider, is_active);
create index if not exists communication_templates_channel_category_idx on public.communication_templates(channel, category) where is_active = true;
create index if not exists communication_templates_created_by_idx on public.communication_templates(created_by);
create index if not exists communications_status_created_idx on public.communications(status, created_at desc);
create index if not exists communications_channel_created_idx on public.communications(channel, created_at desc);
create index if not exists communications_created_by_idx on public.communications(created_by, created_at desc);
create index if not exists communications_related_record_idx on public.communications(related_module, related_record_id);
create index if not exists communication_attachments_communication_idx on public.communication_attachments(communication_id);
create index if not exists communication_logs_communication_created_idx on public.communication_logs(communication_id, created_at desc);
create index if not exists communication_drafts_owner_updated_idx on public.communication_drafts(created_by, updated_at desc);

create or replace function public.communication_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists communication_accounts_updated_at on public.communication_accounts;
create trigger communication_accounts_updated_at before update on public.communication_accounts for each row execute function public.communication_set_updated_at();
drop trigger if exists communication_drafts_updated_at on public.communication_drafts;
create trigger communication_drafts_updated_at before update on public.communication_drafts for each row execute function public.communication_set_updated_at();

alter table public.communication_accounts enable row level security;
alter table public.communication_templates enable row level security;
alter table public.communications enable row level security;
alter table public.communication_attachments enable row level security;
alter table public.communication_logs enable row level security;
alter table public.communication_drafts enable row level security;

-- Accounts: all active CRM users may view; only admins may change.
drop policy if exists communication_accounts_select on public.communication_accounts;
create policy communication_accounts_select on public.communication_accounts for select using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
);
drop policy if exists communication_accounts_admin_insert on public.communication_accounts;
create policy communication_accounts_admin_insert on public.communication_accounts for insert with check (
  created_by=auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='ADMIN')
);
drop policy if exists communication_accounts_admin_update on public.communication_accounts;
create policy communication_accounts_admin_update on public.communication_accounts for update using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='ADMIN')
) with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='ADMIN'));
drop policy if exists communication_accounts_admin_delete on public.communication_accounts;
create policy communication_accounts_admin_delete on public.communication_accounts for delete using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role='ADMIN')
);

-- Templates: all active users read; admins/managers manage.
drop policy if exists communication_templates_select on public.communication_templates;
create policy communication_templates_select on public.communication_templates for select using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
);
drop policy if exists communication_templates_manage_insert on public.communication_templates;
create policy communication_templates_manage_insert on public.communication_templates for insert with check (
  created_by=auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER'))
);
drop policy if exists communication_templates_manage_update on public.communication_templates;
create policy communication_templates_manage_update on public.communication_templates for update using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER'))
) with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER')));
drop policy if exists communication_templates_manage_delete on public.communication_templates;
create policy communication_templates_manage_delete on public.communication_templates for delete using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER'))
);

-- Communications: managers/admins see all; users see and create their own.
drop policy if exists communications_select_scope on public.communications;
create policy communications_select_scope on public.communications for select using (
  created_by=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER'))
);
drop policy if exists communications_insert_own on public.communications;
create policy communications_insert_own on public.communications for insert with check (
  created_by=auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
);
drop policy if exists communications_update_scope on public.communications;
create policy communications_update_scope on public.communications for update using (
  created_by=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER'))
) with check (created_by=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER')));
drop policy if exists communications_delete_scope on public.communications;
create policy communications_delete_scope on public.communications for delete using (
  created_by=auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('ADMIN','MANAGER'))
);

-- Child records inherit communication visibility. Logs are append-only to clients.
drop policy if exists communication_attachments_select on public.communication_attachments;
create policy communication_attachments_select on public.communication_attachments for select using (exists (select 1 from public.communications c where c.id=communication_id));
drop policy if exists communication_attachments_insert on public.communication_attachments;
create policy communication_attachments_insert on public.communication_attachments for insert with check (exists (select 1 from public.communications c where c.id=communication_id));
drop policy if exists communication_attachments_delete on public.communication_attachments;
create policy communication_attachments_delete on public.communication_attachments for delete using (exists (select 1 from public.communications c where c.id=communication_id));
drop policy if exists communication_logs_select on public.communication_logs;
create policy communication_logs_select on public.communication_logs for select using (exists (select 1 from public.communications c where c.id=communication_id));
drop policy if exists communication_logs_insert on public.communication_logs;
create policy communication_logs_insert on public.communication_logs for insert with check (exists (select 1 from public.communications c where c.id=communication_id));

-- Drafts are always private to their creator.
drop policy if exists communication_drafts_own on public.communication_drafts;
create policy communication_drafts_own on public.communication_drafts for all using (created_by=auth.uid()) with check (created_by=auth.uid());

-- Placeholder account. Uses the first admin as owner and is safe to rerun.
insert into public.communication_accounts (provider, display_name, email_address, is_default, is_active, created_by)
select 'GMAIL','Projects','projects@adhunikswitchgears.com',true,false,p.id
from public.profiles p where p.role='ADMIN'
  and not exists (select 1 from public.communication_accounts a where a.email_address='projects@adhunikswitchgears.com')
order by p.created_at limit 1;
