-- Friend plans: deliberately separated from private_workspaces. Only the owner can
-- write the small, purpose-built share snapshot; friends read it through one RPC.
alter table public.account_directory add column if not exists email text;

create or replace function public.uniflow_account_created()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  insert into public.account_directory(user_id,email) values(new.id,lower(new.email))
  on conflict(user_id) do update set email=coalesce(excluded.email,public.account_directory.email);
  return new;
end $$;
update public.account_directory d set email=lower(u.email) from auth.users u where u.id=d.user_id and d.email is null;
create unique index if not exists account_directory_email_unique on public.account_directory(lower(email)) where email is not null;

create table if not exists public.friend_connections(
  owner_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  alias text not null check(length(alias) between 1 and 50),
  created_at timestamptz not null default now(),
  primary key(owner_id,friend_id),check(owner_id<>friend_id)
);
create table if not exists public.friend_shares(
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,share_full_day boolean not null default false,
  paused_until timestamptz,university text not null default '',
  current_event jsonb,day_events jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.friend_connections enable row level security;
alter table public.friend_shares enable row level security;
grant select,insert,update,delete on public.friend_connections,public.friend_shares to authenticated;
create policy "friend links owner" on public.friend_connections for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "share owner select" on public.friend_shares for select to authenticated using(user_id=(select auth.uid()));
create policy "share owner insert" on public.friend_shares for insert to authenticated with check(user_id=(select auth.uid()));
create policy "share owner update" on public.friend_shares for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create or replace function public.uniflow_add_friend(p_email text,p_alias text)
returns void language plpgsql security definer set search_path=''
as $$ declare target uuid; begin
  select user_id into target from public.account_directory where lower(email)=lower(trim(p_email));
  if target is null then raise exception 'Zu dieser E-Mail gibt es noch kein uniflow-Konto.'; end if;
  if target=(select auth.uid()) then raise exception 'Du kannst dich nicht selbst hinzufügen.'; end if;
  insert into public.friend_connections(owner_id,friend_id,alias) values((select auth.uid()),target,trim(p_alias))
  on conflict(owner_id,friend_id) do update set alias=excluded.alias;
end $$;
revoke all on function public.uniflow_add_friend(text,text) from public;grant execute on function public.uniflow_add_friend(text,text) to authenticated;

create or replace function public.uniflow_friend_feed()
returns table(friend_id uuid,alias text,university text,available boolean,paused_until timestamptz,current_event jsonb,day_events jsonb,updated_at timestamptz)
language sql stable security definer set search_path=''
as $$ select c.friend_id,c.alias,coalesce(s.university,''),coalesce(s.enabled,false) and (s.paused_until is null or s.paused_until<=now()),s.paused_until,
  case when s.enabled and (s.paused_until is null or s.paused_until<=now()) then s.current_event end,
  case when s.enabled and s.share_full_day and (s.paused_until is null or s.paused_until<=now()) then s.day_events else '[]'::jsonb end,
  coalesce(s.updated_at,c.created_at)
from public.friend_connections c left join public.friend_shares s on s.user_id=c.friend_id where c.owner_id=(select auth.uid()) order by c.alias $$;
revoke all on function public.uniflow_friend_feed() from public;grant execute on function public.uniflow_friend_feed() to authenticated;
