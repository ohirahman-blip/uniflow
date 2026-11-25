-- Prepared only; apply deliberately before enabling the server flag.
-- No change to existing workspace policies or authentication.
create table if not exists public.uniflow_mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null,
  scopes text[] not null default array['workspace:read']::text[]
    check (cardinality(scopes) between 1 and 2 and scopes <@ array['workspace:read','workspace:propose']::text[]),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  rate_window timestamptz not null default now(),
  rate_count integer not null default 0 check (rate_count >= 0),
  check (expires_at > created_at)
);
create index if not exists uniflow_mcp_tokens_owner on public.uniflow_mcp_tokens(user_id);
alter table public.uniflow_mcp_tokens enable row level security;
revoke all on public.uniflow_mcp_tokens from public, anon, authenticated;
grant select, insert, update, delete on public.uniflow_mcp_tokens to service_role;

create or replace function public.uniflow_mcp_consume_request(p_token_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare permitted uuid;
begin
  update public.uniflow_mcp_tokens
  set rate_count = case when rate_window <= now() - interval '1 minute' then 1 else rate_count + 1 end,
      rate_window = case when rate_window <= now() - interval '1 minute' then now() else rate_window end,
      last_used_at = now()
  where id = p_token_id and revoked_at is null and expires_at > now()
    and (rate_window <= now() - interval '1 minute' or rate_count < 60)
  returning id into permitted;
  return permitted is not null;
end;
$$;
revoke all on function public.uniflow_mcp_consume_request(uuid) from public, anon, authenticated;
grant execute on function public.uniflow_mcp_consume_request(uuid) to service_role;
