-- Customer crypto subscription proof submissions: payment method, TXID and token amount.
alter table public.subscription_payment_requests
  add column if not exists payment_method text not null default 'upi',
  add column if not exists crypto_amount numeric(24,8);

drop function if exists public.submit_subscription_payment_proof(text,text,text);
create or replace function public.submit_subscription_payment_proof(
 p_request_id text,p_utr text,p_proof_path text,p_payment_method text default 'upi',p_crypto_amount numeric default null
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_user_id uuid:=auth.uid();v_request public.subscription_payment_requests%rowtype;v_utr text:=trim(coalesce(p_utr,''));v_method text:=lower(trim(coalesce(p_payment_method,'upi')));
begin
 if v_user_id is null then raise exception 'authenticated_user_required' using errcode='42501';end if;
 if v_method not in ('upi','crypto') then raise exception 'invalid_payment_method' using errcode='22023';end if;
 if (v_method='upi' and v_utr !~ '^[A-Z0-9-]{8,35}$') or (v_method='crypto' and v_utr !~ '^[A-Za-z0-9]{16,128}$') then raise exception 'invalid_transaction_reference' using errcode='22023';end if;
 if v_method='crypto' and (p_crypto_amount is null or p_crypto_amount<=0) then raise exception 'invalid_crypto_amount' using errcode='22023';end if;
 if p_proof_path is null or p_proof_path !~ ('^'||v_user_id::text||'/'||p_request_id||'/proof-[A-Za-z0-9_-]+\.(png|jpe?g|webp)$') then raise exception 'invalid_proof_path' using errcode='22023';end if;
 if not exists(select 1 from storage.objects where bucket_id='xinpay-subscription-proofs' and name=p_proof_path) then raise exception 'payment_proof_not_found' using errcode='P0002';end if;
 update public.subscription_payment_requests set utr=v_utr,proof_path=p_proof_path,payment_method=v_method,crypto_amount=case when v_method='crypto' then p_crypto_amount else null end,submitted_at=now(),status='submitted',updated_at=now() where id=p_request_id and customer_id=v_user_id and status='awaiting_payment' returning * into v_request;
 if not found then raise exception 'subscription_request_not_found_or_not_awaiting_proof' using errcode='P0002';end if;
 return jsonb_build_object('id',v_request.id,'status',v_request.status,'utr',v_request.utr,'paymentMethod',v_request.payment_method,'cryptoAmount',v_request.crypto_amount,'submittedAt',v_request.submitted_at);
end;$$;
grant execute on function public.submit_subscription_payment_proof(text,text,text,text,numeric) to authenticated;
