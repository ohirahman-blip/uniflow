-- UniFlow accounts become visible only after successful email verification.
-- Existing records and private workspaces are preserved, never deleted.
begin;
create or replace function public.uniflow_account_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null then
    insert into public.account_directory(user_id,created_at)
    values(new.id,new.email_confirmed_at) on conflict(user_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists uniflow_account_created on auth.users;
create trigger uniflow_account_created after insert or update of email_confirmed_at on auth.users
for each row execute function public.uniflow_account_created();
insert into public.account_directory(user_id,created_at)
select id,email_confirmed_at from auth.users where email_confirmed_at is not null
on conflict(user_id) do nothing;
create or replace function public.uniflow_admin_accounts()
returns table (user_id uuid,email text,created_at timestamptz,premium boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_uniflow_admin() then
    raise exception 'Not authorized: admin role required' using errcode='42501';
  end if;
  return query select u.id,coalesce(u.email,'')::text,u.email_confirmed_at,coalesce(d.premium,false)
  from auth.users u left join public.account_directory d on d.user_id=u.id
  where u.email_confirmed_at is not null order by u.email_confirmed_at desc;
end;
$$;
revoke all on function public.uniflow_admin_accounts() from public;
grant execute on function public.uniflow_admin_accounts() to authenticated;
commit;
