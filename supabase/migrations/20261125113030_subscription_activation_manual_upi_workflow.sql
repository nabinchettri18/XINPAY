create table public.subscription_payment_requests (
  id text primary key,
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  plan_key text not null check (plan_key in ('starter','business','premium')),
  plan_name text not null,
  amount_minor bigint not null check (amount_minor in (359800,535600,915800)),
  currency text not null default 'INR' check (currency='INR'),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','submitted','approved','rejected')),
  receiver_upi_id text not null,
  receiver_beneficiary text not null,
  receiver_qr_mode text not null check (receiver_qr_mode in ('generated','uploaded')),
  receiver_qr_asset_key text,
  receiver_config_version integer not null default 0,
  utr text,
  proof_path text,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plan_amount_pair check (
    (plan_key='starter' and plan_name='Starter' and amount_minor=359800) or
    (plan_key='business' and plan_name='Business' and amount_minor=535600) or
    (plan_key='premium' and plan_name='Premium' and amount_minor=915800)
  ),
  constraint subscription_utr_proof_pair check (
    (status in ('awaiting_payment','rejected') and (utr is null or proof_path is null))
    or (status in ('submitted','approved') and utr is not null and proof_path is not null and submitted_at is not null)
  )
);

create unique index subscription_payment_requests_utr_unique
  on public.subscription_payment_requests (lower(utr)) where utr is not null;
create index subscription_payment_requests_customer_created
  on public.subscription_payment_requests (customer_id,created_at desc);
create index subscription_payment_requests_status_created
  on public.subscription_payment_requests (status,created_at desc);

create table public.customer_memberships (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  plan_key text not null check (plan_key in ('starter','business','premium')),
  plan_name text not null,
  paid_amount_minor bigint not null check (paid_amount_minor in (359800,535600,915800)),
  activation_request_id text not null unique references public.subscription_payment_requests(id),
  status text not null default 'active' check (status in ('active','suspended')),
  activated_at timestamptz not null default now(),
  activated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.customer_bank_profiles (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  account_holder_name text not null,
  bank_name text not null,
  ifsc_code text not null,
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  upi_id text not null,
  qr_asset_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_bank_profile_ifsc check (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  constraint customer_bank_profile_upi check (upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$')
);

alter table public.subscription_payment_requests enable row level security;
alter table public.customer_memberships enable row level security;
alter table public.customer_bank_profiles enable row level security;
revoke all on public.subscription_payment_requests from anon,authenticated;
grant select on public.subscription_payment_requests to authenticated;
revoke all on public.customer_memberships from anon,authenticated;
grant select on public.customer_memberships to authenticated;
revoke all on public.customer_bank_profiles from anon,authenticated;
grant select,insert,update on public.customer_bank_profiles to authenticated;

create policy subscription_requests_customer_read on public.subscription_payment_requests
  for select to authenticated using (customer_id=(select auth.uid()));
create policy subscription_requests_admin_read on public.subscription_payment_requests
  for select to authenticated using (private.is_xinpay_admin());
create policy customer_memberships_customer_read on public.customer_memberships
  for select to authenticated using (customer_id=(select auth.uid()));
create policy customer_memberships_admin_read on public.customer_memberships
  for select to authenticated using (private.is_xinpay_admin());
create policy customer_bank_profiles_owner_select on public.customer_bank_profiles
  for select to authenticated using (customer_id=(select auth.uid()));
create policy customer_bank_profiles_owner_insert on public.customer_bank_profiles
  for insert to authenticated with check (customer_id=(select auth.uid()));
create policy customer_bank_profiles_owner_update on public.customer_bank_profiles
  for update to authenticated using (customer_id=(select auth.uid()))
  with check (customer_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('xinpay-subscription-proofs','xinpay-subscription-proofs',false,5242880,array['image/png','image/jpeg','image/webp']),
 ('xinpay-customer-bank-qr','xinpay-customer-bank-qr',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy subscription_proofs_customer_upload on storage.objects for insert to authenticated
  with check (bucket_id='xinpay-subscription-proofs' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy subscription_proofs_customer_read on storage.objects for select to authenticated
  using (bucket_id='xinpay-subscription-proofs' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy subscription_proofs_admin_read on storage.objects for select to authenticated
  using (bucket_id='xinpay-subscription-proofs' and private.is_xinpay_admin());
create policy customer_bank_qr_upload on storage.objects for insert to authenticated
  with check (bucket_id='xinpay-customer-bank-qr' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy customer_bank_qr_read on storage.objects for select to authenticated
  using (bucket_id='xinpay-customer-bank-qr' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.create_subscription_payment_request(p_request_id text,p_plan_key text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_email text:=lower(coalesce(auth.jwt()->>'email',''));
  v_plan_name text;
  v_amount_minor bigint;
  v_config public.payment_config%rowtype;
  v_request public.subscription_payment_requests%rowtype;
begin
  if v_user_id is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
  if p_request_id !~ '^sub_[A-Za-z0-9]{12,64}$' then raise exception 'invalid_request_id' using errcode='22023'; end if;
  case p_plan_key
    when 'starter' then v_plan_name:='Starter'; v_amount_minor:=359800;
    when 'business' then v_plan_name:='Business'; v_amount_minor:=535600;
    when 'premium' then v_plan_name:='Premium'; v_amount_minor:=915800;
    else raise exception 'invalid_subscription_plan' using errcode='22023';
  end case;
  select * into v_config from public.payment_config where id='primary';
  if not found or not v_config.enabled
    or coalesce(v_config.receiving_upi_id,'') !~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$'
    or coalesce(v_config.beneficiary_display_name,'')='' then
    raise exception 'subscription_collection_unavailable' using errcode='55000';
  end if;
  if v_config.qr_mode='uploaded' and (v_config.qr_asset_key is null or not exists (
    select 1 from storage.objects where bucket_id='xinpay-payment-qr' and name=v_config.qr_asset_key
  )) then raise exception 'subscription_qr_unavailable' using errcode='55000'; end if;
  insert into public.subscription_payment_requests (
    id,customer_id,customer_email,plan_key,plan_name,amount_minor,currency,status,
    receiver_upi_id,receiver_beneficiary,receiver_qr_mode,receiver_qr_asset_key,receiver_config_version
  ) values (
    p_request_id,v_user_id,v_email,p_plan_key,v_plan_name,v_amount_minor,'INR','awaiting_payment',
    v_config.receiving_upi_id,v_config.beneficiary_display_name,v_config.qr_mode,v_config.qr_asset_key,v_config.version
  ) returning * into v_request;
  return to_jsonb(v_request);
end;
$function$;
revoke all on function public.create_subscription_payment_request(text,text) from public,anon;
grant execute on function public.create_subscription_payment_request(text,text) to authenticated;

create or replace function public.submit_subscription_payment_proof(p_request_id text,p_utr text,p_proof_path text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_request public.subscription_payment_requests%rowtype;
  v_utr text:=upper(trim(coalesce(p_utr,'')));
begin
  if v_user_id is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
  if v_utr !~ '^[A-Z0-9-]{8,35}$' then raise exception 'invalid_utr' using errcode='22023'; end if;
  if p_proof_path is null or p_proof_path !~ ('^'||v_user_id::text||'/'||p_request_id||'/proof-[A-Za-z0-9_-]+\.(png|jpe?g|webp)$') then
    raise exception 'invalid_proof_path' using errcode='22023';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='xinpay-subscription-proofs' and name=p_proof_path) then
    raise exception 'payment_proof_not_found' using errcode='P0002';
  end if;
  update public.subscription_payment_requests
    set utr=v_utr,proof_path=p_proof_path,submitted_at=now(),status='submitted',updated_at=now()
    where id=p_request_id and customer_id=v_user_id and status='awaiting_payment'
    returning * into v_request;
  if not found then raise exception 'subscription_request_not_found_or_not_awaiting_proof' using errcode='P0002'; end if;
  return jsonb_build_object('id',v_request.id,'status',v_request.status,'utr',v_request.utr,'submittedAt',v_request.submitted_at);
end;
$function$;
revoke all on function public.submit_subscription_payment_proof(text,text,text) from public,anon;
grant execute on function public.submit_subscription_payment_proof(text,text,text) to authenticated;

create or replace function public.admin_review_subscription_payment_request(p_request_id text,p_decision text,p_admin_note text,p_confirm_bank_credit boolean)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_request public.subscription_payment_requests%rowtype;
  v_updated public.subscription_payment_requests%rowtype;
  v_actor uuid:=auth.uid();
  v_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if v_actor is null or not private.is_xinpay_admin() then raise exception 'admin_authorization_required' using errcode='42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid_review_decision' using errcode='22023'; end if;
  if p_decision='approve' and p_confirm_bank_credit is not true then raise exception 'bank_credit_confirmation_required' using errcode='42501'; end if;
  select * into v_request from public.subscription_payment_requests where id=p_request_id for update;
  if not found then raise exception 'subscription_request_not_found' using errcode='P0002'; end if;
  if v_request.status<>'submitted' then raise exception 'subscription_request_not_pending_review' using errcode='55000'; end if;
  update public.subscription_payment_requests
    set status=case when p_decision='approve' then 'approved' else 'rejected' end,
        reviewed_by=v_actor,reviewed_at=now(),admin_note=left(trim(coalesce(p_admin_note,'')),1000),updated_at=now()
    where id=p_request_id returning * into v_updated;
  if p_decision='approve' then
    insert into public.customer_memberships(customer_id,plan_key,plan_name,paid_amount_minor,activation_request_id,status,activated_at,activated_by,updated_at)
    values(v_request.customer_id,v_request.plan_key,v_request.plan_name,v_request.amount_minor,v_request.id,'active',now(),v_actor,now())
    on conflict(customer_id) do update set
      plan_key=excluded.plan_key,plan_name=excluded.plan_name,paid_amount_minor=excluded.paid_amount_minor,
      activation_request_id=excluded.activation_request_id,status='active',activated_at=now(),activated_by=v_actor,updated_at=now();
  end if;
  insert into public.audit_logs(id,actor_id,action,target,before_snapshot,after_snapshot)
  values('subreview_'||replace(gen_random_uuid()::text,'-',''),v_email,
    case when p_decision='approve' then 'subscription_payment.approved' else 'subscription_payment.rejected' end,
    'subscription_request:'||p_request_id,to_jsonb(v_request),to_jsonb(v_updated));
  return jsonb_build_object('id',v_updated.id,'customerId',v_updated.customer_id,'status',v_updated.status,
    'planKey',v_updated.plan_key,'amountMinor',v_updated.amount_minor,'reviewedAt',v_updated.reviewed_at);
end;
$function$;
revoke all on function public.admin_review_subscription_payment_request(text,text,text,boolean) from public,anon;
grant execute on function public.admin_review_subscription_payment_request(text,text,text,boolean) to authenticated;

create or replace function public.save_customer_bank_profile(
  p_account_holder_name text,p_bank_name text,p_ifsc_code text,p_account_last4 text,p_upi_id text,p_qr_asset_key text
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_profile public.customer_bank_profiles%rowtype;
  v_upi text:=lower(trim(coalesce(p_upi_id,'')));
  v_ifsc text:=upper(trim(coalesce(p_ifsc_code,'')));
begin
  if v_user_id is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
  if not exists(select 1 from public.customer_memberships where customer_id=v_user_id and status='active') then
    raise exception 'active_subscription_required' using errcode='42501';
  end if;
  if length(trim(coalesce(p_account_holder_name,'')))<2 or length(trim(coalesce(p_account_holder_name,'')))>100
    or length(trim(coalesce(p_bank_name,'')))<2 or length(trim(coalesce(p_bank_name,'')))>100
    or v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' or coalesce(p_account_last4,'') !~ '^[0-9]{4}$'
    or v_upi !~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$' then raise exception 'invalid_bank_profile' using errcode='22023'; end if;
  if p_qr_asset_key is not null and p_qr_asset_key<>'' then
    if p_qr_asset_key !~ ('^'||v_user_id::text||'/profile/qr-[A-Za-z0-9_-]+\.(png|jpe?g|webp)$')
      or not exists(select 1 from storage.objects where bucket_id='xinpay-customer-bank-qr' and name=p_qr_asset_key) then
      raise exception 'invalid_customer_bank_qr' using errcode='22023';
    end if;
  end if;
  insert into public.customer_bank_profiles(customer_id,account_holder_name,bank_name,ifsc_code,account_last4,upi_id,qr_asset_key,updated_at)
  values(v_user_id,trim(p_account_holder_name),trim(p_bank_name),v_ifsc,p_account_last4,v_upi,nullif(p_qr_asset_key,''),now())
  on conflict(customer_id) do update set
    account_holder_name=excluded.account_holder_name,bank_name=excluded.bank_name,ifsc_code=excluded.ifsc_code,
    account_last4=excluded.account_last4,upi_id=excluded.upi_id,qr_asset_key=excluded.qr_asset_key,updated_at=now()
  returning * into v_profile;
  return jsonb_build_object('bankName',v_profile.bank_name,'accountHolderName',v_profile.account_holder_name,
    'accountLast4',v_profile.account_last4,'ifscCode',v_profile.ifsc_code,'upiId',v_profile.upi_id,
    'qrAssetKey',v_profile.qr_asset_key,'updatedAt',v_profile.updated_at);
end;
$function$;
revoke all on function public.save_customer_bank_profile(text,text,text,text,text,text) from public,anon;
grant execute on function public.save_customer_bank_profile(text,text,text,text,text,text) to authenticated;

create or replace function public.consume_rate_limit(p_scope text,p_limit integer)
returns boolean language plpgsql set search_path=''
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_minute bigint:=floor(extract(epoch from now())/60)::bigint;
  v_bucket_key text;
  v_hits integer;
begin
  if v_user_id is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
  if p_scope not in ('admin-orders','admin-verify','orders','direct-orders','customer-orders','subscription-create','subscription-submit','customer-subscription','admin-subscriptions','admin-subscription-review','customer-bank-profile') then
    raise exception 'invalid_rate_limit_scope' using errcode='22023';
  end if;
  if p_limit<1 or p_limit>100 then raise exception 'invalid_rate_limit_limit' using errcode='22023'; end if;
  v_bucket_key:=v_user_id::text||':'||p_scope||':'||v_minute::text;
  insert into public.rate_limit_buckets(bucket_key,hits,window_started)
  values(v_bucket_key,1,to_timestamp(v_minute*60))
  on conflict(bucket_key) do update set hits=public.rate_limit_buckets.hits+1,window_started=excluded.window_started
  returning hits into v_hits;
  if v_minute%120=0 then
    delete from public.rate_limit_buckets where bucket_key like v_user_id::text||':%' and window_started<now()-interval '24 hours';
  end if;
  return v_hits<=p_limit;
end;
$function$;
