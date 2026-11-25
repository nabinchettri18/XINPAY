-- Manual UPI wallet top-up requests. Wallet credits require admin bank-credit verification.
create table if not exists public.customer_wallet_topup_requests(
 id text primary key,
 customer_id uuid not null references auth.users(id) on delete cascade,
 amount_minor bigint not null check(amount_minor>=10000 and amount_minor<=100000000),
 currency text not null default 'INR' check(currency='INR'),
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','submitted','approved','rejected')),
 receiver_upi_id text not null,
 receiver_beneficiary text not null,
 receiver_qr_mode text not null,
 receiver_qr_asset_key text,
 receiver_config_version integer not null,
 utr text,
 proof_path text,
 submitted_at timestamptz,
 admin_note text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists wallet_topup_customer_created_idx on public.customer_wallet_topup_requests(customer_id,created_at desc);
alter table public.customer_wallet_topup_requests enable row level security;
drop policy if exists "wallet topup customer read" on public.customer_wallet_topup_requests;
create policy "wallet topup customer read" on public.customer_wallet_topup_requests for select to authenticated using(customer_id=(select auth.uid()));
drop policy if exists "wallet topup admin read" on public.customer_wallet_topup_requests;
create policy "wallet topup admin read" on public.customer_wallet_topup_requests for select to authenticated using(private.is_xinpay_admin());
grant select on public.customer_wallet_topup_requests to authenticated;

create or replace function public.create_wallet_topup_request(p_id text,p_amount_minor bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_config public.payment_config%rowtype; v_row public.customer_wallet_topup_requests%rowtype;
begin
 if v_user is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
 if p_id !~ '^top_[A-Za-z0-9]{12,64}$' or p_amount_minor<10000 or p_amount_minor>100000000 then raise exception 'topup_amount_out_of_range' using errcode='22023'; end if;
 select * into v_config from public.payment_config where id='primary';
 if not found or not v_config.enabled or coalesce(v_config.receiving_upi_id,'') !~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z]{2,64}$' or coalesce(v_config.beneficiary_display_name,'')='' then raise exception 'wallet_topup_collection_unavailable' using errcode='55000'; end if;
 insert into public.customer_wallet_topup_requests(id,customer_id,amount_minor,receiver_upi_id,receiver_beneficiary,receiver_qr_mode,receiver_qr_asset_key,receiver_config_version)
 values(p_id,v_user,p_amount_minor,v_config.receiving_upi_id,v_config.beneficiary_display_name,v_config.qr_mode,v_config.qr_asset_key,v_config.version) returning * into v_row;
 return jsonb_build_object('id',v_row.id,'amount_minor',v_row.amount_minor,'upi_id',v_row.receiver_upi_id,'beneficiary',v_row.receiver_beneficiary,'qr_mode',v_row.receiver_qr_mode,'qr_asset_key',v_row.receiver_qr_asset_key,'config_version',v_row.receiver_config_version,'status',v_row.status);
end; $$;
create or replace function public.submit_wallet_topup_proof(p_id text,p_utr text,p_proof_path text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_row public.customer_wallet_topup_requests%rowtype; v_utr text:=upper(trim(coalesce(p_utr,'')));
begin
 if v_user is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
 if v_utr !~ '^[A-Z0-9-]{8,35}$' then raise exception 'invalid_utr' using errcode='22023'; end if;
 if p_proof_path is null or p_proof_path !~ ('^'||v_user::text||'/'||p_id||'/proof-[A-Za-z0-9_-]+\.(png|jpe?g|webp)$') then raise exception 'invalid_topup_proof_path' using errcode='22023'; end if;
 if not exists(select 1 from storage.objects where bucket_id='xinpay-subscription-proofs' and name=p_proof_path) then raise exception 'topup_proof_not_found' using errcode='P0002'; end if;
 update public.customer_wallet_topup_requests set utr=v_utr,proof_path=p_proof_path,submitted_at=now(),status='submitted',updated_at=now() where id=p_id and customer_id=v_user and status='awaiting_payment' returning * into v_row;
 if not found then raise exception 'topup_not_found_or_not_awaiting_proof' using errcode='P0002'; end if;
 return jsonb_build_object('id',v_row.id,'status',v_row.status,'utr',v_row.utr,'submitted_at',v_row.submitted_at);
end; $$;
create or replace function public.admin_list_wallet_topups(p_status text default 'submitted')
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_rows jsonb;
begin
 if auth.uid() is null or not private.is_xinpay_admin() then raise exception 'admin_authorization_required' using errcode='42501'; end if;
 if p_status not in ('submitted','approved','rejected','all') then raise exception 'invalid_topup_filter' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.submitted_at desc),'[]'::jsonb) into v_rows from
 (select r.*,u.email customer_email from public.customer_wallet_topup_requests r left join auth.users u on u.id=r.customer_id where p_status='all' or r.status=p_status order by r.submitted_at desc limit 200)t;
 return v_rows;
end; $$;
create or replace function public.admin_review_wallet_topup(p_id text,p_decision text,p_note text,p_confirm_bank_credit boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_row public.customer_wallet_topup_requests%rowtype;
begin
 if auth.uid() is null or not private.is_xinpay_admin() then raise exception 'admin_authorization_required' using errcode='42501'; end if;
 if p_decision not in ('approve','reject') then raise exception 'invalid_topup_decision' using errcode='22023'; end if;
 if p_decision='approve' and p_confirm_bank_credit is not true then raise exception 'bank_credit_confirmation_required' using errcode='42501'; end if;
 if p_decision='reject' and length(trim(coalesce(p_note,'')))<3 then raise exception 'rejection_reason_required' using errcode='22023'; end if;
 select * into v_row from public.customer_wallet_topup_requests where id=p_id for update;
 if not found or v_row.status<>'submitted' then raise exception 'topup_not_pending_review' using errcode='55000'; end if;
 update public.customer_wallet_topup_requests set status=p_decision||'d',admin_note=left(trim(coalesce(p_note,'')),1000),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_id returning * into v_row;
 if p_decision='approve' then
   insert into public.customer_wallet_accounts(customer_id) values(v_row.customer_id) on conflict(customer_id) do nothing;
   insert into public.customer_wallet_ledger(id,customer_id,entry_type,amount_minor,source_type,source_id,description)
   values('wtop_'||replace(gen_random_uuid()::text,'-',''),v_row.customer_id,'credit',v_row.amount_minor,'wallet_topup_request',v_row.id,'Wallet top-up verified by admin')
   on conflict(source_type,source_id,entry_type) do nothing;
 end if;
 insert into public.audit_logs(id,actor_id,action,target,after_snapshot) values('topreview_'||replace(gen_random_uuid()::text,'-',''),lower(coalesce(auth.jwt()->>'email','')),'wallet_topup.'||p_decision,'wallet_topup:'||p_id,to_jsonb(v_row));
 return jsonb_build_object('id',v_row.id,'status',v_row.status,'reviewed_at',v_row.reviewed_at);
end; $$;
revoke all on function public.create_wallet_topup_request(text,bigint) from public,anon;
revoke all on function public.submit_wallet_topup_proof(text,text,text) from public,anon;
revoke all on function public.admin_list_wallet_topups(text) from public,anon;
revoke all on function public.admin_review_wallet_topup(text,text,text,boolean) from public,anon;
grant execute on function public.create_wallet_topup_request(text,bigint) to authenticated;
grant execute on function public.submit_wallet_topup_proof(text,text,text) to authenticated;
grant execute on function public.admin_list_wallet_topups(text) to authenticated;
grant execute on function public.admin_review_wallet_topup(text,text,text,boolean) to authenticated;