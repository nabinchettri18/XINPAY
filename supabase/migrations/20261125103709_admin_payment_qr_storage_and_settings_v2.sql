insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('xinpay-payment-qr', 'xinpay-payment-qr', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "xinpay_qr_admin_upload" on storage.objects;
create policy "xinpay_qr_admin_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'xinpay-payment-qr'
  and (storage.foldername(name))[1] = 'payment-qr'
  and private.is_xinpay_admin()
);

drop policy if exists "xinpay_qr_admin_delete" on storage.objects;
create policy "xinpay_qr_admin_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'xinpay-payment-qr'
  and (storage.foldername(name))[1] = 'payment-qr'
  and private.is_xinpay_admin()
);

create or replace function public.admin_update_payment_config_with_qr(
  p_upi_id text,
  p_beneficiary text,
  p_instructions text,
  p_enabled boolean,
  p_qr_asset_key text,
  p_qr_mode text,
  p_actor text,
  p_audit_id text
)
returns public.payment_config
language plpgsql
set search_path = ''
as $function$
declare
  v_before public.payment_config%rowtype;
  v_after public.payment_config%rowtype;
  v_qr_asset_key text := nullif(trim(coalesce(p_qr_asset_key, '')), '');
  v_upi_id text := trim(coalesce(p_upi_id, ''));
  v_beneficiary text := left(trim(coalesce(p_beneficiary, '')), 200);
  v_instructions text := left(trim(coalesce(p_instructions, '')), 1000);
begin
  if not private.is_xinpay_admin() then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;
  if lower(coalesce(p_actor, '')) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'admin_actor_mismatch' using errcode = '42501';
  end if;
  if p_enabled and (v_upi_id !~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$' or v_beneficiary = '') then
    raise exception 'valid_upi_and_beneficiary_required' using errcode = '22023';
  end if;
  if v_upi_id <> '' and v_upi_id !~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$' then
    raise exception 'invalid_upi_id' using errcode = '22023';
  end if;
  if p_qr_mode not in ('generated', 'uploaded') then
    raise exception 'invalid_qr_mode' using errcode = '22023';
  end if;
  if p_qr_mode = 'uploaded' and (
    v_qr_asset_key is null
    or v_qr_asset_key !~ '^payment-qr/qr-[A-Za-z0-9_-]+\.(png|jpe?g|webp)$'
  ) then
    raise exception 'valid_uploaded_qr_required' using errcode = '22023';
  end if;
  if p_qr_mode = 'generated' then
    v_qr_asset_key := null;
  end if;

  select * into v_before
  from public.payment_config
  where id = 'primary'
  for update;

  update public.payment_config
  set receiving_upi_id = v_upi_id,
      beneficiary_display_name = v_beneficiary,
      instructions = v_instructions,
      enabled = p_enabled,
      qr_asset_key = v_qr_asset_key,
      qr_mode = p_qr_mode,
      version = version + 1,
      updated_at = now(),
      updated_by = p_actor
  where id = 'primary'
  returning * into v_after;

  if not found then
    raise exception 'payment_config_not_found';
  end if;

  insert into public.audit_logs(id, actor_id, action, target, before_snapshot, after_snapshot)
  values (
    p_audit_id,
    p_actor,
    'payment_config.updated',
    'payment_config:primary',
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return v_after;
end;
$function$;

revoke all on function public.admin_update_payment_config_with_qr(text,text,text,boolean,text,text,text,text) from public, anon;
grant execute on function public.admin_update_payment_config_with_qr(text,text,text,boolean,text,text,text,text) to authenticated, service_role;
