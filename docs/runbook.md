# XinPay Operations Runbook

## Incident: payment status mismatch
1. Disable payment initiation feature flag.
2. Do not manually mark an order paid from a customer screenshot or UTR.
3. Compare provider dashboard/API, webhook event, XinPay order, and bank/provider reconciliation.
4. Preserve event hash, provider reference, timestamps, and audit records.
5. Put unmatched cases into review and notify support.

## Credential compromise
1. Rotate the affected provider or Worker secret immediately.
2. Review audit logs and provider dashboard for suspicious requests.
3. Revoke sessions/Access identities as appropriate.
4. Disable payment initiation until verification is complete.
5. Record incident and recovery steps.

## Backup / recovery
- Export D1 data using approved Cloudflare tooling and store encrypted in access-controlled backup storage.
- Test restore to a non-production database before relying on backups.
- Record retention and deletion policy for customer data.

## Deployment rollback
- Keep the last known-good Worker deployment.
- Roll back code if health checks fail; do not roll back database migrations destructively.
- Reconcile transactions before reopening payment initiation.
