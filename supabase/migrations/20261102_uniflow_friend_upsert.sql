-- Re-adding the same email updates the existing friendship name instead of
-- creating a duplicate or returning an error.
create or replace function public.uniflow_add_friend(p_email text,p_alias text)
returns void language plpgsql security definer set search_path=''
as $$ declare target uuid; existing public.friend_connections; begin
  select user_id into target from public.account_directory where lower(email)=lower(trim(p_email));
  if target is null then raise exception 'Zu dieser E-Mail gibt es noch kein uniflow-Konto.'; end if;
  if target=(select auth.uid()) then raise exception 'Du kannst dich nicht selbst hinzufügen.'; end if;
  select * into existing from public.friend_connections where (owner_id=(select auth.uid()) and friend_id=target) or (owner_id=target and friend_id=(select auth.uid())) limit 1;
  if existing.owner_id=(select auth.uid()) then
    update public.friend_connections set alias=trim(p_alias) where owner_id=(select auth.uid()) and friend_id=target;
  elsif existing.friend_id=(select auth.uid()) and existing.status='accepted' then
    update public.friend_connections set recipient_alias=trim(p_alias) where owner_id=target and friend_id=(select auth.uid());
  elsif existing.owner_id=target then
    raise exception 'Diese Person hat dir bereits eine Anfrage geschickt.';
  else
    insert into public.friend_connections(owner_id,friend_id,alias,status) values((select auth.uid()),target,trim(p_alias),'pending');
  end if;
end $$;
