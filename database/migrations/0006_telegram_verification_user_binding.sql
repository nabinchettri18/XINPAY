alter table public.telegram_phone_verifications add column if not exists customer_id uuid references auth.users(id) on delete cascade;
create index if not exists telegram_phone_verifications_customer_created on public.telegram_phone_verifications(customer_id,created_at desc);
alter table public.telegram_phone_verifications alter column customer_id set not null;