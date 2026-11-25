create table if not exists public.xinpay_bank_accounts (
 id uuid primary key default gen_random_uuid(),
 account_holder_name text not null check(length(trim(account_holder_name)) between 2 and 100),
 bank_name text not null check(length(trim(bank_name)) between 2 and 100),
 account_last4 text not null check(account_last4 ~ '^[0-9]{4}$'),
 ifsc_code text not null check(ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
 account_type text not null default 'Savings',
 branch_name text not null default '',
 upi_id text not null default '',
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected')),
 is_primary boolean not null default false,
 notes text not null default '',
 is_archived boolean not null default false,
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists xinpay_bank_accounts_active_primary_idx on public.xinpay_bank_accounts(is_archived,is_primary,created_at desc);
create unique index if not exists xinpay_bank_accounts_one_primary on public.xinpay_bank_accounts(is_primary) where is_primary=true and is_archived=false;
alter table public.xinpay_bank_accounts enable row level security;
revoke all on public.xinpay_bank_accounts from anon,authenticated;
grant select,insert,update on public.xinpay_bank_accounts to authenticated;
create policy xinpay_bank_accounts_admin_access on public.xinpay_bank_accounts
 for all to authenticated
 using (private.is_xinpay_admin())
 with check (private.is_xinpay_admin());
