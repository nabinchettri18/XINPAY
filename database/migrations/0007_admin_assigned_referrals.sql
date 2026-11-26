-- Admin-assigned XinPay referral links and referral attribution.
create table if not exists public.customer_referral_links (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(customer_id, id)
);
create unique index if not exists customer_referral_links_one_active_per_customer
  on public.customer_referral_links(customer_id) where revoked_at is null;
create index if not exists customer_referral_links_code_active
  on public.customer_referral_links(code) where revoked_at is null;

create table if not exists public.customer_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid not null references auth.users(id) on delete cascade,
  referred_customer_id uuid not null unique references auth.users(id) on delete cascade,
  referral_link_id uuid not null references public.customer_referral_links(id),
  referral_code text not null,
  status text not null default 'registered' check(status in ('registered','verified','qualified','rewarded','rejected')),
  reward_minor bigint not null default 0 check(reward_minor>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(referrer_customer_id <> referred_customer_id)
);
create index if not exists customer_referrals_referrer_created
  on public.customer_referrals(referrer_customer_id,created_at desc);

alter table public.customer_referral_links enable row level security;
alter table public.customer_referrals enable row level security;
drop policy if exists "customers read own referral links" on public.customer_referral_links;
create policy "customers read own referral links" on public.customer_referral_links
  for select to authenticated using(customer_id=auth.uid());
drop policy if exists "customers read own referrals" on public.customer_referrals;
create policy "customers read own referrals" on public.customer_referrals
  for select to authenticated using(referrer_customer_id=auth.uid());
grant select on public.customer_referral_links,public.customer_referrals to authenticated;

create or replace function public.xinpay_capture_signup_referral()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_code text; v_link public.customer_referral_links%rowtype;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
  if v_code = '' then return new; end if;
  select * into v_link from public.customer_referral_links
    where code=v_code and revoked_at is null;
  if not found or v_link.customer_id=new.id then return new; end if;
  insert into public.customer_referrals(referrer_customer_id,referred_customer_id,referral_link_id,referral_code)
  values(v_link.customer_id,new.id,v_link.id,v_link.code)
  on conflict(referred_customer_id) do nothing;
  return new;
end;
$$;
revoke all on function public.xinpay_capture_signup_referral() from public,anon,authenticated;
drop trigger if exists xinpay_capture_signup_referral on auth.users;
create trigger xinpay_capture_signup_referral after insert on auth.users
for each row execute function public.xinpay_capture_signup_referral();

create or replace function public.admin_list_referral_accounts(p_search text default '')
returns table(customer_id uuid,email text,full_name text,referral_code text,link_created_at timestamptz,link_revoked_at timestamptz,referral_count bigint,qualified_count bigint,rewarded_minor bigint)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not private.is_xinpay_admin() then
   raise exception 'admin_authorization_required' using errcode='42501';
 end if;
 return query
 select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),
   l.code,l.created_at,l.revoked_at,
   count(r.id),count(r.id) filter(where r.status in ('qualified','rewarded')),
   coalesce(sum(r.reward_minor) filter(where r.status='rewarded'),0)
 from auth.users u
 left join lateral (select * from public.customer_referral_links x where x.customer_id=u.id order by x.created_at desc limit 1) l on true
 left join public.customer_referrals r on r.referrer_customer_id=u.id
 where coalesce(p_search,'')='' or u.email ilike '%'||p_search||'%' or u.id::text ilike '%'||p_search||'%' or coalesce(u.raw_user_meta_data->>'full_name','') ilike '%'||p_search||'%'
 group by u.id,u.email,u.raw_user_meta_data,l.code,l.created_at,l.revoked_at
 order by u.created_at desc limit 250;
end;
$$;

create or replace function public.admin_create_referral_link(p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_code text; v_link public.customer_referral_links%rowtype;
begin
 if v_user is null or not private.is_xinpay_admin() then
   raise exception 'admin_authorization_required' using errcode='42501';
 end if;
 if not exists(select 1 from auth.users where id=p_customer_id) then raise exception 'customer_not_found'; end if;
 update public.customer_referral_links set revoked_at=now()
   where customer_id=p_customer_id and revoked_at is null;
 v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 insert into public.customer_referral_links(customer_id,code,created_by)
 values(p_customer_id,v_code,v_user) returning * into v_link;
 return jsonb_build_object('id',v_link.id,'customer_id',v_link.customer_id,'code',v_link.code,'created_at',v_link.created_at);
end;
$$;

create or replace function public.admin_revoke_referral_link(p_customer_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not private.is_xinpay_admin() then
   raise exception 'admin_authorization_required' using errcode='42501';
 end if;
 update public.customer_referral_links set revoked_at=now()
   where customer_id=p_customer_id and revoked_at is null;
 return found;
end;
$$;

create or replace function public.customer_referral_summary()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_link public.customer_referral_links%rowtype; v_items jsonb; v_total bigint; v_qualified bigint; v_rewarded bigint; v_rewards bigint;
begin
 if v_user is null then raise exception 'authenticated_user_required' using errcode='42501'; end if;
 select * into v_link from public.customer_referral_links where customer_id=v_user and revoked_at is null order by created_at desc limit 1;
 select count(*),count(*) filter(where status in ('qualified','rewarded')),count(*) filter(where status='rewarded'),coalesce(sum(reward_minor) filter(where status='rewarded'),0)
 into v_total,v_qualified,v_rewarded,v_rewards from public.customer_referrals where referrer_customer_id=v_user;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'reward_minor',reward_minor,'created_at',created_at) order by created_at desc),'[]'::jsonb)
 into v_items from (select id,status,reward_minor,created_at from public.customer_referrals where referrer_customer_id=v_user order by created_at desc limit 100) q;
 return jsonb_build_object('link_code',v_link.code,'link_created_at',v_link.created_at,'link_revoked_at',v_link.revoked_at,'total_referrals',v_total,'qualified_referrals',v_qualified,'rewarded_referrals',v_rewarded,'rewards_minor',v_rewards,'referrals',v_items);
end;
$$;

revoke all on function public.admin_list_referral_accounts(text) from public,anon;
revoke all on function public.admin_create_referral_link(uuid) from public,anon;
revoke all on function public.admin_revoke_referral_link(uuid) from public,anon;
revoke all on function public.customer_referral_summary() from public,anon;
grant execute on function public.admin_list_referral_accounts(text) to authenticated;
grant execute on function public.admin_create_referral_link(uuid) to authenticated;
grant execute on function public.admin_revoke_referral_link(uuid) to authenticated;
grant execute on function public.customer_referral_summary() to authenticated;
