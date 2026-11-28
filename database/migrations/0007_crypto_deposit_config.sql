-- EASEPAY crypto deposit destination settings
alter table public.payment_config
  add column if not exists crypto_enabled boolean not null default false,
  add column if not exists crypto_asset text not null default 'USDT',
  add column if not exists crypto_network text not null default 'TRON (TRC20)',
  add column if not exists crypto_wallet_address text,
  add column if not exists crypto_memo text,
  add column if not exists crypto_instructions text not null default 'Send only the selected asset on the selected network. Confirm the address and network before sending.';
