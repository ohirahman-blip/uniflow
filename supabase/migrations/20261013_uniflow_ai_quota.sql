-- Server-side DeepSeek quota for uniflow+.
-- Run in Supabase SQL Editor before enabling the AI Edge Function.
-- Never let the browser write this table or decide whether a user is premium.

create table if not exists public.uniflow_ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  request_count integer not null default 0 check (request_count >= 0),
  last_request_at timestamptz not null default now(),
  primary key (user_id,usage_day)
);
alter table public.uniflow_ai_daily_usage enable row level security;

-- No authenticated/anon table policies. Only the SECURITY DEFINER RPC below
-- consumes quota. A unique (user,day) row makes the limit atomic on races.
revoke all on public.uniflow_ai_daily_usage from anon,authenticated;

create or replace function public.uniflow_consume_ai_quota()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  caller uuid := auth.uid();
  consumed integer;
begin
  if caller is null then return false; end if;

  -- Read the canonical, admin-controlled premium flag; a client UI switch
  -- or a forged request payload is not sufficient.
  if not exists (
    select 1
    from public.account_directory a
    where a.user_id = caller and a.premium is true
  ) then
    return false;
  end if;

  insert into public.uniflow_ai_daily_usage as usage (
    user_id,usage_day,request_count,last_request_at
  ) values (
    caller,(now() at time zone 'UTC')::date,1,now()
  )
  on conflict (user_id,usage_day)
  do update set
    request_count = usage.request_count+1,
    last_request_at = now()
  where usage.request_count < 25
    -- No hourly or 90-second rate throttle: opening the app can request
    -- immediately again, up to the hard daily 25-request limit.
  returning request_count into consumed;

  return consumed is not null;
end;
$function$;

revoke all on function public.uniflow_consume_ai_quota() from public,anon;
grant execute on function public.uniflow_consume_ai_quota() to authenticated;

-- Optional cleanup (e.g. monthly), retain no old usage history indefinitely:
-- delete from public.uniflow_ai_daily_usage
-- where usage_day < (now() at time zone 'UTC')::date - 35;
