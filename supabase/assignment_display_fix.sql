drop policy if exists "profiles_select_by_role" on public.profiles;

create policy "profiles_select_by_role" on public.profiles for select
using (is_active = true or id = auth.uid() or public.current_profile_role() in ('ADMIN','MANAGER'));
