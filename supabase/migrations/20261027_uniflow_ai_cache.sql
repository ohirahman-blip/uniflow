-- Apply before deploying BOTH updated AI functions. Existing data is preserved.
begin;
create table if not exists public.uniflow_ai_advice_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recommendation jsonb,
  signature text not null default '',
  generated_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz,
  failed_attempts integer not null default 0 check(failed_attempts>=0)
);
alter table public.uniflow_ai_advice_cache enable row level security;
revoke all on public.uniflow_ai_advice_cache from public,anon,authenticated;
grant select(user_id,recommendation,signature,generated_at,next_attempt_at) on public.uniflow_ai_advice_cache to authenticated;
grant all on public.uniflow_ai_advice_cache to service_role;
drop policy if exists "read own premium advice" on public.uniflow_ai_advice_cache;
create policy "read own premium advice" on public.uniflow_ai_advice_cache for select to authenticated
using(user_id=(select auth.uid()) and exists(select 1 from public.account_directory a where a.user_id=(select auth.uid()) and a.premium is true));

create table if not exists public.uniflow_ai_schedule_throttle (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_request_at timestamptz not null
);
alter table public.uniflow_ai_schedule_throttle enable row level security;
revoke all on public.uniflow_ai_schedule_throttle from public,anon,authenticated;
grant all on public.uniflow_ai_schedule_throttle to service_role;

-- Server-only: unlimited daily quick entries, at most one start per 15 seconds.
create or replace function public.uniflow_acquire_ai_schedule(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare accepted uuid;
begin
  if not exists(select 1 from public.account_directory where user_id=p_user_id and premium is true) then return false; end if;
  insert into public.uniflow_ai_schedule_throttle as t(user_id,last_request_at) values(p_user_id,clock_timestamp())
  on conflict(user_id) do update set last_request_at=clock_timestamp()
  where t.last_request_at<=clock_timestamp()-interval '15 seconds'
  returning user_id into accepted;
  return accepted is not null;
end;
$$;

-- Row lock + short lease prevent duplicate paid requests across devices/tabs.
create or replace function public.uniflow_acquire_ai_advice(p_user_id uuid,p_signature text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.uniflow_ai_advice_cache%rowtype; current_time_at timestamptz:=clock_timestamp(); retry_at timestamptz;
begin
  if p_lease is null or p_signature is null or length(p_signature)=0 or length(p_signature)>9000 or not exists(select 1 from public.account_directory where user_id=p_user_id and premium is true) then
    raise exception 'Premium account required' using errcode='42501';
  end if;
  insert into public.uniflow_ai_advice_cache(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select * into saved from public.uniflow_ai_advice_cache where user_id=p_user_id for update;
  if saved.recommendation is not null and saved.generated_at is not null and
     (saved.generated_at>current_time_at-interval '30 minutes' or
      (saved.signature=p_signature and saved.generated_at>current_time_at-interval '4 hours')) then
    return jsonb_build_object('status','cached','recommendation',saved.recommendation,'signature',saved.signature,'generatedAt',saved.generated_at,'retryAt',saved.next_attempt_at);
  end if;
  retry_at:=greatest(saved.lease_until,saved.next_attempt_at);
  if retry_at>current_time_at then
    return jsonb_build_object('status','pending','recommendation',saved.recommendation,'signature',saved.signature,'generatedAt',saved.generated_at,'retryAt',retry_at);
  end if;
  update public.uniflow_ai_advice_cache set lease_token=p_lease,lease_until=current_time_at+interval '60 seconds',next_attempt_at=current_time_at+interval '5 minutes' where user_id=p_user_id;
  return jsonb_build_object('status','generate');
end;
$$;

create or replace function public.uniflow_finish_ai_advice(p_user_id uuid,p_lease uuid,p_signature text,p_recommendation jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare updated_user uuid;
begin
  if p_recommendation is not null then
    if jsonb_typeof(p_recommendation)<>'object' or octet_length(p_recommendation::text)>5000 then raise exception 'Invalid recommendation'; end if;
    update public.uniflow_ai_advice_cache set recommendation=p_recommendation,signature=p_signature,generated_at=clock_timestamp(),lease_token=null,lease_until=null,next_attempt_at=null,failed_attempts=0
    where user_id=p_user_id and lease_token=p_lease returning user_id into updated_user;
  else
    update public.uniflow_ai_advice_cache set failed_attempts=least(failed_attempts+1,100),lease_token=null,lease_until=null,
      next_attempt_at=clock_timestamp()+case when failed_attempts=0 then interval '5 minutes' when failed_attempts=1 then interval '15 minutes' else interval '1 hour' end
    where user_id=p_user_id and lease_token=p_lease returning user_id into updated_user;
  end if;
  return updated_user is not null;
end;
$$;
revoke all on function public.uniflow_acquire_ai_schedule(uuid) from public,anon,authenticated;
revoke all on function public.uniflow_acquire_ai_advice(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.uniflow_finish_ai_advice(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.uniflow_acquire_ai_schedule(uuid) to service_role;
grant execute on function public.uniflow_acquire_ai_advice(uuid,text,uuid) to service_role;
grant execute on function public.uniflow_finish_ai_advice(uuid,uuid,text,jsonb) to service_role;
-- The old quota table/function remain for rollback; new functions do not use them.
commit;
