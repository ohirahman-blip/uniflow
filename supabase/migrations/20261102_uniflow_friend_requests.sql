alter table public.friend_connections add column if not exists status text not null default 'pending' check(status in('pending','accepted'));
alter table public.friend_connections add column if not exists recipient_alias text;
alter table public.friend_connections add column if not exists accepted_at timestamptz;

create or replace function public.uniflow_add_friend(p_email text,p_alias text)
returns void language plpgsql security definer set search_path=''
as $$ declare target uuid; existing public.friend_connections; begin
  select user_id into target from public.account_directory where lower(email)=lower(trim(p_email));
  if target is null then raise exception 'Zu dieser E-Mail gibt es noch kein uniflow-Konto.'; end if;
  if target=(select auth.uid()) then raise exception 'Du kannst dich nicht selbst hinzufügen.'; end if;
  select * into existing from public.friend_connections where (owner_id=(select auth.uid()) and friend_id=target) or (owner_id=target and friend_id=(select auth.uid())) limit 1;
  if existing.status='accepted' then raise exception 'Ihr seid bereits befreundet.'; end if;
  if existing.owner_id=target then raise exception 'Diese Person hat dir bereits eine Anfrage geschickt.'; end if;
  insert into public.friend_connections(owner_id,friend_id,alias,status) values((select auth.uid()),target,trim(p_alias),'pending') on conflict(owner_id,friend_id) do update set alias=excluded.alias;
end $$;

create or replace function public.uniflow_accept_friend(p_requester uuid,p_alias text)
returns void language plpgsql security definer set search_path=''
as $$ begin
  update public.friend_connections set status='accepted',recipient_alias=trim(p_alias),accepted_at=now() where owner_id=p_requester and friend_id=(select auth.uid()) and status='pending';
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;
end $$;
revoke all on function public.uniflow_accept_friend(uuid,text) from public;grant execute on function public.uniflow_accept_friend(uuid,text) to authenticated;

create or replace function public.uniflow_remove_friend(p_friend uuid)
returns void language sql security definer set search_path=''
as $$ delete from public.friend_connections where (owner_id=(select auth.uid()) and friend_id=p_friend) or (friend_id=(select auth.uid()) and owner_id=p_friend) $$;
revoke all on function public.uniflow_remove_friend(uuid) from public;grant execute on function public.uniflow_remove_friend(uuid) to authenticated;

create or replace function public.uniflow_friend_requests()
returns table(requester_id uuid,email text,direction text) language sql stable security definer set search_path=''
as $$ select c.owner_id,d.email,'incoming'::text from public.friend_connections c join public.account_directory d on d.user_id=c.owner_id where c.friend_id=(select auth.uid()) and c.status='pending'
union all select c.friend_id,d.email,'outgoing'::text from public.friend_connections c join public.account_directory d on d.user_id=c.friend_id where c.owner_id=(select auth.uid()) and c.status='pending' $$;
revoke all on function public.uniflow_friend_requests() from public;grant execute on function public.uniflow_friend_requests() to authenticated;

create or replace function public.uniflow_friend_feed()
returns table(friend_id uuid,alias text,university text,available boolean,paused_until timestamptz,current_event jsonb,day_events jsonb,updated_at timestamptz)
language sql stable security definer set search_path=''
as $$ with mutual as(
 select c.friend_id,c.alias from public.friend_connections c where c.owner_id=(select auth.uid()) and c.status='accepted'
 union all select c.owner_id,c.recipient_alias from public.friend_connections c where c.friend_id=(select auth.uid()) and c.status='accepted'
) select m.friend_id,m.alias,coalesce(s.university,''),coalesce(s.enabled,false) and (s.paused_until is null or s.paused_until<=now()),s.paused_until,
case when s.enabled and (s.paused_until is null or s.paused_until<=now()) then s.current_event end,
case when s.enabled and s.share_full_day and (s.paused_until is null or s.paused_until<=now()) then s.day_events else '[]'::jsonb end,
coalesce(s.updated_at,now()) from mutual m left join public.friend_shares s on s.user_id=m.friend_id order by m.alias $$;
