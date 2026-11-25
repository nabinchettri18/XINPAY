-- Telegram-linked phone verification for XinPay (server-only access)
create table if not exists public.telegram_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  link_token_hash text not null unique,
  telegram_user_id text,
  telegram_chat_id text,
  otp_hash text,
  status text not null default 'pending_link'
    check (status in ('pending_link','linked','otp_sent','verified','expired','failed')),
  link_expires_at timestamptz not null,
  otp_expires_at timestamptz,
  otp_attempts integer not null default 0 check (otp_attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);
create index if not exists telegram_phone_verifications_status_expiry
  on public.telegram_phone_verifications(status, link_expires_at, otp_expires_at);
create index if not exists telegram_phone_verifications_user_chat
  on public.telegram_phone_verifications(telegram_user_id, telegram_chat_id, created_at desc);
alter table public.telegram_phone_verifications enable row level security;
-- No anon/authenticated policies. The Vercel API uses the server-only Supabase key.

create table if not exists public.telegram_rate_limits (
  bucket_key text primary key,
  hits integer not null default 0 check (hits >= 0),
  window_started timestamptz not null default now()
);
alter table public.telegram_rate_limits enable row level security;

create or replace function public.consume_telegram_rate_limit(
  p_bucket text, p_max_hits integer, p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare current_hits integer;
begin
  insert into public.telegram_rate_limits(bucket_key,hits,window_started)
  values(p_bucket,1,now())
  on conflict(bucket_key) do update
    set hits = case
      when telegram_rate_limits.window_started <= now() - make_interval(secs => p_window_seconds) then 1
      else telegram_rate_limits.hits + 1
    end,
    window_started = case
      when telegram_rate_limits.window_started <= now() - make_interval(secs => p_window_seconds) then now()
      else telegram_rate_limits.window_started
    end
  returning hits into current_hits;
  return current_hits <= p_max_hits;
end;
$$;
revoke all on function public.consume_telegram_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_telegram_rate_limit(text,integer,integer) to service_role;
