-- UniFlow 0.4: identity, catalog and a PRIVATE, owner-only cloud workspace.
-- Execute this once in Supabase SQL Editor. Do not expose service_role keys in Vite.
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);

create or replace function public.is_uniflow_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin');
$$;
revoke all on function public.is_uniflow_admin() from public;
grant execute on function public.is_uniflow_admin() to authenticated;

create table if not exists public.account_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  premium boolean not null default false
);

-- Admins can view account ID, registration date, premium. NOT university,
-- study program, timetable, grades, private notes or private workspace payload.
create or replace function public.uniflow_account_created()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.account_directory(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists uniflow_account_created on auth.users;
create trigger uniflow_account_created after insert on auth.users
for each row execute procedure public.uniflow_account_created();
insert into public.account_directory(user_id,created_at)
select id, created_at from auth.users on conflict(user_id) do nothing;

create table if not exists public.private_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.university_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
create table if not exists public.degree_catalog (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.university_catalog(id) on delete cascade,
  name text not null,
  level text not null check (level in ('Bachelor','Master')),
  target_credits int not null default 180 check (target_credits between 1 and 480),
  unique (university_id,name,level)
);
create table if not exists public.module_catalog (
  id uuid primary key default gen_random_uuid(),
  degree_catalog_id uuid not null references public.degree_catalog(id) on delete cascade,
  name text not null,
  credits numeric(5,1) not null default 6 check (credits >= 0 and credits <= 100),
  unique (degree_catalog_id,name)
);

-- Explicit grants; row policies still restrict access to the appropriate roles.
grant select on public.user_roles, public.account_directory to authenticated;
grant select,insert,update,delete on public.private_workspaces to authenticated;
grant select on public.university_catalog, public.degree_catalog, public.module_catalog to anon,authenticated;
grant insert,update,delete on public.university_catalog, public.degree_catalog, public.module_catalog to authenticated;

alter table public.user_roles enable row level security;
alter table public.account_directory enable row level security;
alter table public.private_workspaces enable row level security;
alter table public.university_catalog enable row level security;
alter table public.degree_catalog enable row level security;
alter table public.module_catalog enable row level security;

create policy "role self read" on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));
create policy "account self or admin read" on public.account_directory for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_uniflow_admin()));
create policy "workspace owner read" on public.private_workspaces for select to authenticated
using (user_id = (select auth.uid()));
create policy "workspace owner insert" on public.private_workspaces for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "workspace owner update" on public.private_workspaces for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workspace owner delete" on public.private_workspaces for delete to authenticated
using (user_id = (select auth.uid()));

create policy "public university catalog" on public.university_catalog for select to anon,authenticated using (true);
create policy "public degree catalog" on public.degree_catalog for select to anon,authenticated using (true);
create policy "public module catalog" on public.module_catalog for select to anon,authenticated using (true);
create policy "admin edit university" on public.university_catalog for all to authenticated
using ((select public.is_uniflow_admin())) with check ((select public.is_uniflow_admin()));
create policy "admin edit degree" on public.degree_catalog for all to authenticated
using ((select public.is_uniflow_admin())) with check ((select public.is_uniflow_admin()));
create policy "admin edit module" on public.module_catalog for all to authenticated
using ((select public.is_uniflow_admin())) with check ((select public.is_uniflow_admin()));

-- Premium can ONLY be changed by this privileged server-side function.
create or replace function public.admin_set_premium(p_target uuid, p_premium boolean)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_uniflow_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.account_directory set premium = p_premium where user_id = p_target;
  if not found then raise exception 'Account not found'; end if;
end;
$$;
revoke all on function public.admin_set_premium(uuid,boolean) from public;
grant execute on function public.admin_set_premium(uuid,boolean) to authenticated;

-- Seed demonstrative catalog ONLY with known/example offering; not a comprehensive
-- verified list of universities, degrees, modules or academic regulations.
insert into public.university_catalog(name) values
('Technische Universität Berlin'),('Humboldt-Universität zu Berlin'),('Freie Universität Berlin')
on conflict(name) do nothing;
insert into public.degree_catalog(university_id,name,level,target_credits)
select u.id,'Wirtschaftsinformatik','Bachelor',180 from public.university_catalog u
where u.name='Technische Universität Berlin'
on conflict(university_id,name,level) do nothing;

-- Promote the FIRST admin only after they have signed in with Apple:
-- insert into public.user_roles(user_id,role) values ('USER_UUID_FROM_AUTH_USERS','admin');
-- Never add a client-side "become admin" function or use service_role in the browser.
