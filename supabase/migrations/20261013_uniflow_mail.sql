-- UniFlow mailbox and web-push metadata. Mail passwords are encrypted by the
-- server API before insertion; browser roles never receive table privileges.
create table if not exists public.mail_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  username text not null,
  imap_host text not null,
  imap_port int not null check (imap_port between 1 and 65535),
  imap_secure boolean not null default true,
  smtp_host text not null,
  smtp_port int not null check (smtp_port between 1 and 65535),
  smtp_secure boolean not null default true,
  encrypted_password text not null,
  history_mode text not null default 'all' check (history_mode in ('all','new')),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_notified_uid bigint not null default 0,
  status text not null default 'connected' check (status in ('connected','error')),
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists public.mail_thread_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  correspondent text not null,
  muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, correspondent)
);

create table if not exists public.mail_sent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  to_address text not null,
  subject text not null default '',
  body_text text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  sent_at timestamptz not null default now()
);
create index if not exists mail_sent_messages_user_sent_idx on public.mail_sent_messages(user_id, sent_at desc);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'Europe/Berlin',
  mail_enabled boolean not null default false,
  lesson_feedback_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

create table if not exists public.notification_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_key text not null,
  delivered_at timestamptz not null default now(),
  primary key (user_id, delivery_key)
);

alter table public.mail_accounts enable row level security;
alter table public.mail_thread_preferences enable row level security;
alter table public.mail_sent_messages enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

-- Intentionally no grants or browser policies: only the server-side service role
-- can read credentials, message cache and push endpoints.
revoke all on public.mail_accounts, public.mail_thread_preferences,
  public.mail_sent_messages, public.push_subscriptions,
  public.notification_deliveries from anon, authenticated;
