-- Fix admin referral account RPC return-type mismatches.
-- auth.users.email is varchar; the declared RPC output is text.
create or replace function public.admin_list_referral_accounts(p_search text default '')
returns table(customer_id uuid,email text,full_name text,referral_code text,link_created_at timestamptz,link_revoked_at timestamptz,referral_count bigint,qualified_count bigint,rewarded_minor bigint)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not private.is_xinpay_admin() then
   raise exception 'admin_authorization_required' using errcode='42501';
 end if;
 return query
 select u.id,
   u.email::text,
   coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','')::text,
   l.code::text,
   l.created_at,
   l.revoked_at,
   count(r.id)::bigint,
   count(r.id) filter(where r.status in ('qualified','rewarded'))::bigint,
   coalesce(sum(r.reward_minor) filter(where r.status='rewarded'),0)::bigint
 from auth.users u
 left join lateral (select * from public.customer_referral_links x where x.customer_id=u.id order by x.created_at desc limit 1) l on true
 left join public.customer_referrals r on r.referrer_customer_id=u.id
 where coalesce(p_search,'')='' or u.email ilike '%'||p_search||'%' or u.id::text ilike '%'||p_search||'%' or coalesce(u.raw_user_meta_data->>'full_name','') ilike '%'||p_search||'%'
 group by u.id,u.email,u.raw_user_meta_data,l.code,l.created_at,l.revoked_at
 order by u.created_at desc limit 250;
end;
$$;
