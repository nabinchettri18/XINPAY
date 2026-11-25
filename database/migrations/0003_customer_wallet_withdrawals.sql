-- XinPay wallet ledger and customer withdrawals.
-- Wallet credits are created only from payment_received ledger entries tied to
-- paid payment_orders with purpose='wallet_topup'. This trigger is idempotent.
create table if not exists public.customer_wallet_accounts (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'INR' check(currency='INR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.customer_wallet_ledger (
  id text primary key,
  customer_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check(entry_type in ('credit','debit')),
  amount_minor bigint not null check(amount_minor>0),
  currency text not null default 'INR' check(currency='INR'),
  source_type text not null,
  source_id text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique(source_type,source_id,entry_type)
);
create index if not exists customer_wallet_ledger_customer_created_idx on public.customer_wallet_ledger(customer_id,created_at desc);
create table if not exists public.customer_withdrawal_requests (
  id text primary key,
  customer_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint not null check(amount_minor>=10000),
  currency text not null default 'INR' check(currency='INR'),
  payout_method text not null check(payout_method in ('UPI','BANK')),
  payout_destination text not null,
  status text not null default 'requested' check(status in ('requested','processing','paid','rejected')),
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz
);
create index if not exists customer_withdrawals_customer_idx on public.customer_withdrawal_requests(customer_id,requested_at desc);

alter table public.customer_wallet_accounts enable row level security;
alter table public.customer_wallet_ledger enable row level security;
alter table public.customer_withdrawal_requests enable row level security;
drop policy if exists "wallet account owner read" on public.customer_wallet_accounts;
create policy "wallet account owner read" on public.customer_wallet_accounts for select to authenticated using(customer_id=(select auth.uid()));
drop policy if exists "wallet ledger owner read" on public.customer_wallet_ledger;
create policy "wallet ledger owner read" on public.customer_wallet_ledger for select to authenticated using(customer_id=(select auth.uid()));
drop policy if exists "withdrawal owner read" on public.customer_withdrawal_requests;
create policy "withdrawal owner read" on public.customer_withdrawal_requests for select to authenticated using(customer_id=(select auth.uid()));
grant select on public.customer_wallet_accounts,public.customer_wallet_ledger,public.customer_withdrawal_requests to authenticated;

create or replace function public.xinpay_wallet_credit_verified_payment()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_customer uuid; v_purpose text;
begin
 if new.entry_type='payment_received' then
   select nullif(customer_id,'')::uuid,purpose into v_customer,v_purpose
   from public.payment_orders where id=new.order_id and status='paid';
   if v_customer is not null and v_purpose='wallet_topup' then
     insert into public.customer_wallet_accounts(customer_id) values(v_customer) on conflict(customer_id) do nothing;
     insert into public.customer_wallet_ledger(id,customer_id,entry_type,amount_minor,source_type,source_id,description)
     values('wcr_'||replace(gen_random_uuid()::text,'-',''),v_customer,'credit',new.amount_minor,'payment_order',new.order_id,'Verified wallet top-up')
     on conflict(source_type,source_id,entry_type) do nothing;
   end if;
 end if;
 return new;
end; $$;
revoke all on function public.xinpay_wallet_credit_verified_payment() from public,anon,authenticated;
drop trigger if exists wallet_credit_verified_payment on public.ledger_entries;
create trigger wallet_credit_verified_payment after insert on public.ledger_entries for each row execute function public.xinpay_wallet_credit_verified_payment();

create or replace function public.customer_wallet_summary()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_available bigint; v_pending bigint; v_transactions jsonb; v_withdrawals jsonb;
begin
 if v_user is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
 select coalesce(sum(case when entry_type='credit' then amount_minor else -amount_minor end),0)
 into v_available from public.customer_wallet_ledger where customer_id=v_user;
 select coalesce(sum(amount_minor),0) into v_pending from public.customer_withdrawal_requests where customer_id=v_user and status in ('requested','processing');
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) into v_transactions
 from (select id,entry_type,amount_minor,description,source_type,created_at from public.customer_wallet_ledger where customer_id=v_user order by created_at desc limit 50)t;
 select coalesce(jsonb_agg(to_jsonb(w) order by w.requested_at desc),'[]'::jsonb) into v_withdrawals
 from (select id,amount_minor,payout_method,payout_destination,status,admin_note,requested_at,reviewed_at,paid_at from public.customer_withdrawal_requests where customer_id=v_user order by requested_at desc limit 25)w;
 return jsonb_build_object('available_minor',v_available-v_pending,'ledger_balance_minor',v_available,'pending_minor',v_pending,'transactions',v_transactions,'withdrawals',v_withdrawals);
end; $$;

create or replace function public.customer_request_withdrawal(p_id text,p_amount_minor bigint,p_method text,p_destination text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_balance bigint; v_row public.customer_withdrawal_requests%rowtype; v_destination text:=trim(coalesce(p_destination,''));
begin
 if v_user is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
 if p_id !~ '^wd_[A-Za-z0-9]{12,64}$' or p_amount_minor<10000 or p_amount_minor>100000000 then raise exception 'invalid_withdrawal_amount_or_id' using errcode='22023'; end if;
 if p_method not in ('UPI','BANK') or length(v_destination)<5 or length(v_destination)>200 then raise exception 'invalid_payout_destination' using errcode='22023'; end if;
 if p_method='UPI' and v_destination !~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z]{2,64}$' then raise exception 'invalid_upi_destination' using errcode='22023'; end if;
 if p_method='BANK' and v_destination !~ '^[A-Za-z0-9 .,#/-]{8,200}$' then raise exception 'invalid_bank_destination' using errcode='22023'; end if;
 insert into public.customer_wallet_accounts(customer_id) values(v_user) on conflict(customer_id) do nothing;
 perform 1 from public.customer_wallet_accounts where customer_id=v_user for update;
 select coalesce(sum(case when entry_type='credit' then amount_minor else -amount_minor end),0)-coalesce((select sum(amount_minor) from public.customer_withdrawal_requests where customer_id=v_user and status in ('requested','processing')),0)
 into v_balance from public.customer_wallet_ledger where customer_id=v_user;
 if p_amount_minor>v_balance then raise exception 'insufficient_available_balance' using errcode='22003'; end if;
 insert into public.customer_withdrawal_requests(id,customer_id,amount_minor,payout_method,payout_destination)
 values(p_id,v_user,p_amount_minor,p_method,v_destination) returning * into v_row;
 return jsonb_build_object('id',v_row.id,'status',v_row.status,'amount_minor',v_row.amount_minor,'requested_at',v_row.requested_at);
end; $$;

create or replace function public.admin_list_withdrawal_requests(p_status text default 'requested')
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_rows jsonb;
begin
 if auth.uid() is null or not private.is_xinpay_admin() then raise exception 'admin_authorization_required' using errcode='42501'; end if;
 if p_status not in ('requested','processing','paid','rejected','all') then raise exception 'invalid_status_filter' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.requested_at desc),'[]'::jsonb) into v_rows
 from (select w.*,u.email customer_email from public.customer_withdrawal_requests w left join auth.users u on u.id=w.customer_id where p_status='all' or w.status=p_status order by w.requested_at desc limit 200)t;
 return v_rows;
end; $$;

create or replace function public.admin_review_withdrawal(p_id text,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_row public.customer_withdrawal_requests%rowtype;
begin
 if auth.uid() is null or not private.is_xinpay_admin() then raise exception 'admin_authorization_required' using errcode='42501'; end if;
 if p_decision not in ('processing','rejected') then raise exception 'invalid_withdrawal_decision' using errcode='22023'; end if;
 if p_decision='rejected' and length(trim(coalesce(p_note,'')))<3 then raise exception 'rejection_reason_required' using errcode='22023'; end if;
 select * into v_row from public.customer_withdrawal_requests where id=p_id for update;
 if not found or v_row.status<>'requested' then raise exception 'withdrawal_not_pending' using errcode='55000'; end if;
 update public.customer_withdrawal_requests set status=p_decision,admin_note=left(trim(coalesce(p_note,'')),1000),reviewed_by=auth.uid(),reviewed_at=now() where id=p_id returning * into v_row;
 insert into public.audit_logs(id,actor_id,action,target,after_snapshot) values('wdreview_'||replace(gen_random_uuid()::text,'-',''),lower(coalesce(auth.jwt()->>'email','')),'withdrawal.'||p_decision,'withdrawal:'||p_id,to_jsonb(v_row));
 return jsonb_build_object('id',v_row.id,'status',v_row.status,'reviewed_at',v_row.reviewed_at);
end; $$;

create or replace function public.admin_mark_withdrawal_paid(p_id text,p_note text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_row public.customer_withdrawal_requests%rowtype;
begin
 if auth.uid() is null or not private.is_xinpay_admin() then raise exception 'admin_authorization_required' using errcode='42501'; end if;
 if length(trim(coalesce(p_note,'')))<3 then raise exception 'payout_reference_required' using errcode='22023'; end if;
 select * into v_row from public.customer_withdrawal_requests where id=p_id for update;
 if not found or v_row.status<>'processing' then raise exception 'withdrawal_not_processing' using errcode='55000'; end if;
 insert into public.customer_wallet_ledger(id,customer_id,entry_type,amount_minor,source_type,source_id,description)
 values('wdebit_'||replace(gen_random_uuid()::text,'-',''),v_row.customer_id,'debit',v_row.amount_minor,'withdrawal_payout',v_row.id,'Withdrawal paid')
 on conflict(source_type,source_id,entry_type) do nothing;
 update public.customer_withdrawal_requests set status='paid',paid_at=now(),admin_note=left(trim(coalesce(p_note,'')),1000) where id=p_id returning * into v_row;
 insert into public.audit_logs(id,actor_id,action,target,after_snapshot) values('wdpaid_'||replace(gen_random_uuid()::text,'-',''),lower(coalesce(auth.jwt()->>'email','')),'withdrawal.paid','withdrawal:'||p_id,to_jsonb(v_row));
 return jsonb_build_object('id',v_row.id,'status',v_row.status,'paid_at',v_row.paid_at);
end; $$;

revoke all on function public.customer_wallet_summary() from public,anon;
revoke all on function public.customer_request_withdrawal(text,bigint,text,text) from public,anon;
revoke all on function public.admin_list_withdrawal_requests(text) from public,anon;
revoke all on function public.admin_review_withdrawal(text,text,text) from public,anon;
revoke all on function public.admin_mark_withdrawal_paid(text,text) from public,anon;
grant execute on function public.customer_wallet_summary() to authenticated;
grant execute on function public.customer_request_withdrawal(text,bigint,text,text) to authenticated;
grant execute on function public.admin_list_withdrawal_requests(text) to authenticated;
grant execute on function public.admin_review_withdrawal(text,text,text) to authenticated;
grant execute on function public.admin_mark_withdrawal_paid(text,text) to authenticated;