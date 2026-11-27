-- Admin-managed USDT receiving destination. Crypto collection is opt-in and manually reviewed.
alter table public.payment_config
  add column if not exists crypto_enabled boolean not null default false,
  add column if not exists crypto_asset text not null default 'USDT',
  add column if not exists crypto_network text not null default 'TRC20 (Tron)',
  add column if not exists crypto_address text,
  add column if not exists crypto_instructions text not null default 'Send only USDT on the selected network. Verify the network and address before sending. Payments are manually reviewed.';

do $$
begin
  if not exists(select 1 from pg_constraint where conname='payment_config_crypto_asset_check') then
    alter table public.payment_config add constraint payment_config_crypto_asset_check check (crypto_asset in ('USDT')) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='payment_config_crypto_network_check') then
    alter table public.payment_config add constraint payment_config_crypto_network_check check (crypto_network in ('TRC20 (Tron)','ERC20 (Ethereum)','BEP20 (BNB Smart Chain)','Polygon','Solana')) not valid;
  end if;
end $$;
