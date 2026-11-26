-- Admin referral review, qualification and reward recording.
create table if not exists public.customer_referral_review_events (
 id uuid primary key default gen_random_uuid(),
 referral_id uuid not null references public.customer_referrals(id) on delete cascade,
 admin_user_id uuid not null references auth.users(id),
 previous_status text,
 new_status text not null check(new_status in ('registered','verified','qualified','rewarded','rejected')),
 previous_reward_minor bigint not null default 0,
 new_reward_minor bigint not null default 0,
 note text,
 created_at timestamptz not null default now()
);
alter table public.customer_referral_review_events enable row level security;
revoke all on public.customer_referral_review_events from anon,authenticated;

create or replace function public.admin_list_referrals(p_search text default '',p_status text default '')
returns table(referral_id uuid,referrer_customer_id uuid,referrer_email text,referrer_name text,referred_customer_id uuid,referred_email text,referred_name text,referral_code text,status text,reward_minor bigint,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not private.is_xinpay_admin() then
  raise exception 'admin_authorization_required' using errcode='42501';
 end if;
 return query
 select r.id,r.referrer_customer_id,ref.email,coalesce(ref.raw_user_meta_data->>'full_name',ref.raw_user_meta_data->>'name',''),
  r.referred_customer_id,sub.email,coalesce(sub.raw_user_meta_data->>'full_name',sub.raw_user_meta_data->>'name',''),
  r.referral_code,r.status,r.reward_minor,r.created_at,r.updated_at
 from public.customer_referrals r
 join auth.users ref on ref.id=r.referrer_customer_id
 join auth.users sub on sub.id=r.referred_customer_id
 where (coalesce(p_search,'')='' or ref.email ilike '%'||p_search||'%' or sub.email ilike '%'||p_search||'%' or ref.id::text ilike '%'||p_search||'%' or sub.id::text ilike '%'||p_search||'%' or coalesce(ref.raw_user_meta_data->>'full_name','') ilike '%'||p_search||'%' or coalesce(sub.raw_user_meta_data->>'full_name','') ilike '%'||p_search||'%' or r.referral_code ilike '%'||p_search||'%')
 and (coalesce(p_status,'')='' or r.status=p_status)
 order by r.created_at desc limit 500;
end;
$$;

create or replace function public.admin_update_referral(p_referral_id uuid,p_status text,p_reward_minor bigint default 0,p_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_admin uuid:=auth.uid(); v_old public.customer_referrals%rowtype; v_updated public.customer_referrals%rowtype;
begin
 if v_admin is null or not private.is_xinpay_admin() then
  raise exception 'admin_authorization_required' using errcode='42501';
 end if;
 if p_status not in ('registered','verified','qualified','rewarded','rejected') then raise exception 'invalid_referral_status'; end if;
 if p_reward_minor is null or p_reward_minor<0 then raise exception 'invalid_reward_amount'; end if;
 if p_status<>'rewarded' and p_reward_minor<>0 then raise exception 'reward_amount_only_allowed_for_rewarded_status'; end if;
 select * into v_old from public.customer_referrals where id=p_referral_id for update;
 if not found then raise exception 'referral_not_found'; end if;
 update public.customer_referrals set status=p_status,reward_minor=p_reward_minor,updated_at=now()
  where id=p_referral_id returning * into v_updated;
 insert into public.customer_referral_review_events(referral_id,admin_user_id,previous_status,new_status,previous_reward_minor,new_reward_minor,note)
 values(v_old.id,v_admin,v_old.status,p_status,v_old.reward_minor,p_reward_minor,nullif(trim(coalesce(p_note,'')),''));
 return jsonb_build_object('id',v_updated.id,'status',v_updated.status,'reward_minor',v_updated.reward_minor,'updated_at',v_updated.updated_at);
end;
$$;

revoke all on function public.admin_list_referrals(text,text) from public,anon;
revoke all on function public.admin_update_referral(uuid,text,bigint,text) from public,anon;
grant execute on function public.admin_list_referrals(text,text) to authenticated;
grant execute on function public.admin_update_referral(uuid,text,bigint,text) to authenticated;
