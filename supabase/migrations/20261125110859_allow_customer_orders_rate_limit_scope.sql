create or replace function public.consume_rate_limit(p_scope text, p_limit integer)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_minute bigint := floor(extract(epoch from now()) / 60)::bigint;
  v_bucket_key text;
  v_hits integer;
begin
  if v_user_id is null then
    raise exception 'authenticated_user_required' using errcode='42501';
  end if;

  if p_scope not in ('admin-orders','admin-verify','orders','direct-orders','customer-orders') then
    raise exception 'invalid_rate_limit_scope' using errcode='22023';
  end if;

  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_rate_limit_limit' using errcode='22023';
  end if;

  v_bucket_key := v_user_id::text || ':' || p_scope || ':' || v_minute::text;

  insert into public.rate_limit_buckets(bucket_key,hits,window_started)
  values(v_bucket_key,1,to_timestamp(v_minute * 60))
  on conflict(bucket_key) do update
    set hits=public.rate_limit_buckets.hits+1,
        window_started=excluded.window_started
  returning hits into v_hits;

  if v_minute % 120 = 0 then
    delete from public.rate_limit_buckets
    where bucket_key like v_user_id::text || ':%'
      and window_started < now() - interval '24 hours';
  end if;

  return v_hits <= p_limit;
end;
$function$;
