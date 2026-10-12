-- UniFlow 0.6: Allow only the verified admin role to search account emails.
-- NOTE: execute this migration in Supabase SQL Editor once, after the 0.4 migration.
-- The function never exposes private_workspaces, university or timetable details.
create or replace function public.uniflow_admin_accounts()
returns table (user_id uuid, email text, created_at timestamptz, premium boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_uniflow_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select u.id, coalesce(u.email,''), u.created_at, coalesce(a.premium,false)
  from auth.users u left join public.account_directory a on a.user_id = u.id
  order by u.created_at desc;
end;
$$;
revoke all on function public.uniflow_admin_accounts() from public;
grant execute on function public.uniflow_admin_accounts() to authenticated;
