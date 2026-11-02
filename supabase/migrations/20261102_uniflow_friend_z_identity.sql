-- Friend identities stay private to the signed-in user: the email is exposed
-- only through this accepted-friend feed and aliases can only be changed by
-- the user who owns that side of the friendship.
create or replace function public.uniflow_friend_feed_v2()
returns table(friend_id uuid,alias text,email text,university text,available boolean,paused_until timestamptz,current_event jsonb,day_events jsonb,updated_at timestamptz)
language sql stable security definer set search_path=''
as $$ with mutual as(
  select c.friend_id,c.alias from public.friend_connections c where c.owner_id=(select auth.uid()) and c.status='accepted'
  union all select c.owner_id,c.recipient_alias from public.friend_connections c where c.friend_id=(select auth.uid()) and c.status='accepted'
) select m.friend_id,coalesce(m.alias,split_part(d.email,'@',1)),coalesce(d.email,''),coalesce(s.university,''),
coalesce(s.enabled,false) and (s.paused_until is null or s.paused_until<=now()),s.paused_until,
case when s.enabled and (s.paused_until is null or s.paused_until<=now()) then s.current_event end,
case when s.enabled and s.share_full_day and (s.paused_until is null or s.paused_until<=now()) then s.day_events else '[]'::jsonb end,
coalesce(s.updated_at,now()) from mutual m join public.account_directory d on d.user_id=m.friend_id
left join public.friend_shares s on s.user_id=m.friend_id order by m.alias $$;
revoke all on function public.uniflow_friend_feed_v2() from public;
grant execute on function public.uniflow_friend_feed_v2() to authenticated;

create or replace function public.uniflow_rename_friend(p_friend uuid,p_alias text)
returns void language plpgsql security definer set search_path=''
as $$ begin
  if length(trim(p_alias)) not between 1 and 50 then raise exception 'Der Name muss zwischen 1 und 50 Zeichen lang sein.'; end if;
  update public.friend_connections set alias=trim(p_alias)
  where owner_id=(select auth.uid()) and friend_id=p_friend and status='accepted';
  if found then return; end if;
  update public.friend_connections set recipient_alias=trim(p_alias)
  where friend_id=(select auth.uid()) and owner_id=p_friend and status='accepted';
  if not found then raise exception 'Freundschaft nicht gefunden.'; end if;
end $$;
revoke all on function public.uniflow_rename_friend(uuid,text) from public;
grant execute on function public.uniflow_rename_friend(uuid,text) to authenticated;
