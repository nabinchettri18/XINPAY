-- Require an authenticated administrator identity AND MFA assurance level 2
-- for every privileged database operation. The public helper remains identity-only
-- so the admin frontend can start the MFA enrollment/challenge flow.
create or replace function private.is_xinpay_admin_identity()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1 from private.admin_allowlist a
    where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))
  );
$$;

revoke all on function private.is_xinpay_admin_identity() from public,anon;
grant execute on function private.is_xinpay_admin_identity() to authenticated;

create or replace function private.is_xinpay_admin()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select private.is_xinpay_admin_identity()
     and coalesce(auth.jwt()->>'aal','aal1')='aal2';
$$;

revoke all on function private.is_xinpay_admin() from public,anon;
grant execute on function private.is_xinpay_admin() to authenticated;

create or replace function public.is_xinpay_admin()
returns boolean
language sql
stable
set search_path=''
as $$ select private.is_xinpay_admin_identity(); $$;

revoke all on function public.is_xinpay_admin() from public,anon;
grant execute on function public.is_xinpay_admin() to authenticated;
