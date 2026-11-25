alter table public.subscription_payment_requests drop constraint if exists subscription_utr_proof_pair;
alter table public.subscription_payment_requests add constraint subscription_utr_proof_pair check (
  (status='awaiting_payment' and utr is null and proof_path is null and submitted_at is null)
  or (status in ('submitted','approved','rejected') and utr is not null and proof_path is not null and submitted_at is not null)
);
