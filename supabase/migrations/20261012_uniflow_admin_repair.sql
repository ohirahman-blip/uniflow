-- UniFlow 0.7 ADMIN REPAIR
-- Run once in Supabase SQL Editor as project owner, AFTER core migration.
-- Admins can access account emails and premium status, NOT private workspaces.
-- The function obeys application admin role, not any client-side flag.
create or replace function public.uniflow_admin_accounts()
returns table (user_id uuid, email text, created_at timestamptz, premium boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_uniflow_admin() then
    raise exception 'Not authorized: admin role required' using errcode = '42501';
  end if;
  return query
    select u.id, coalesce(u.email, '')::text, u.created_at, coalesce(d.premium, false)
    from auth.users u
    left join public.account_directory d on d.user_id = u.id
    order by u.created_at desc;
end;
$$;
revoke all on function public.uniflow_admin_accounts() from public;
grant execute on function public.uniflow_admin_accounts() to authenticated;
-- If you need the FIRST admin, replace the UUID after signing in:
-- insert into public.user_roles (user_id, role)
-- values ('REPLACE_WITH_AUTH_USERS_UUID', 'admin')
-- on conflict (user_id) do update set role = excluded.role;
-- After running: reload UniFlow; the schema cache may need a moment to update.
