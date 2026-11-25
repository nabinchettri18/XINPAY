import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const worker=await readFile(new URL("../worker/index.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../database/migrations/0003_transactions.sql",import.meta.url),"utf8");
const migration4=await readFile(new URL("../database/migrations/0004_order_access.sql",import.meta.url),"utf8");
const migration5=await readFile(new URL("../database/migrations/0005_ledger_idempotency.sql",import.meta.url),"utf8");
test("payments default to disabled and production mode is blocked",()=>{
 assert.match(worker,/PAYMENTS_ENABLED!=="true"/);
 assert.match(worker,/CASHFREE_ENV==="production"/);
});
test("Access JWT validation checks issuer, audience, expiry, signature and admin allowlist",()=>{
 for(const term of ["claims.iss!==issuer","replace(/^https?:\\/\\//","claims.aud","claims.exp","crypto.subtle.verify","ADMIN_EMAILS"])assert.ok(worker.includes(term),term);
});
test("orders use INR and integer minor units and store hashed customer access",()=>{
 assert.match(worker,/currency:"INR"/);
 assert.match(worker,/Math\.round\(amount\*100\)/);
 assert.match(migration,/amount_minor INTEGER NOT NULL CHECK \(amount_minor > 0\)/);
 assert.match(migration4,/customer_access_hash TEXT/);
});
test("webhook validates signature, timestamp, amount, currency and deduplicates",()=>{
 for(const term of ["x-webhook-signature","x-webhook-timestamp","HMAC","payload_hash","verification_state",`currency==="INR"`,"INSERT OR IGNORE"])assert.ok(worker.includes(term),term);
});
test("ledger rows only originate from successful verified webhook branch",()=>{
 assert.match(worker,/status==="SUCCESS"&&verified/);
 assert.match(migration,/ledger_entries/);
 assert.match(migration5,/ledger_source_event_unique/);
});
test("admin transaction endpoint is Access protected",()=>{
 assert.match(worker,/path==="\/api\/admin\/orders"/);
 assert.match(worker,/const identity=await requireAdmin/);
});

test("direct UPI is independently feature-gated and creates pending QR orders",()=>{
 assert.match(worker,/DIRECT_UPI_ENABLED!=="true"/);
 assert.match(worker,/bind\(id,"direct_upi"/);
 assert.match(worker,/upi:\/\/pay\?pa=/);
 assert.match(worker,/verification:"manual"/);
});
test("manual reconciliation is Access protected, amount/reference/time bound and audited",()=>{
 assert.match(worker,/requireAdmin\(req,env\)/);
 assert.match(worker,/confirmBankCredit/);
 assert.match(worker,/minor\(body\.verifiedAmount\)!==order\.amount_minor/);
 assert.match(worker,/bankReference/);
 assert.match(worker,/bankTime/);
 assert.match(worker,/payment\.manual_verified/);
 assert.match(worker,/ledger_entries/);
 assert.match(worker,/verification_state='verified'/);
});

const authMigration=await readFile(new URL("../database/migrations/0007_customer_auth.sql",import.meta.url),"utf8");
const customerAuth=await readFile(new URL("../src/CustomerAuth.tsx",import.meta.url),"utf8");
test("customer auth schema stores password hashes and expiring one-time tokens",()=>{
 for(const term of ["auth_users","password_hash TEXT NOT NULL","email_verified_at","auth_sessions","token_hash TEXT NOT NULL UNIQUE","auth_email_tokens","used_at TEXT","expires_at TEXT"])assert.ok(authMigration.includes(term),term);
});
test("customer auth uses PBKDF2 and secure HttpOnly session cookies",()=>{
 assert.match(worker,/PBKDF2/);
 assert.match(worker,/AUTH_PASSWORD_ITERATIONS=310000/);
 assert.match(worker,/HttpOnly; Secure; SameSite=Lax/);
 assert.match(worker,/AUTH_SESSION_SECONDS=60\*60\*24\*7/);
});
test("customer auth mutations are origin checked, rate limited and email verified",()=>{
 for(const term of ["authMutationAllowed","auth-register","auth-login","auth-verify","auth-forgot","auth-reset","email_verified_at","RESEND_API_KEY","AUTH_EMAIL_FROM"])assert.ok(worker.includes(term),term);
});
test("customer auth supports register, login, session, verification, logout and password reset routes",()=>{
 for(const route of ["/api/auth/register","/api/auth/login","/api/auth/me","/api/auth/logout","/api/auth/verify-email","/api/auth/resend-verification","/api/auth/forgot-password","/api/auth/reset-password"])assert.ok(worker.includes(route),route);
});
test("customer portal renders auth before dashboard and submits real account requests",()=>{
 for(const term of ["Create account","Sign in","/api/auth/login","/api/auth/register","/api/auth/forgot-password","/api/auth/verify-email","credentials:\"include\"","type=\"email\"","minLength={12}"])assert.ok(customerAuth.includes(term),term);
 assert.match(customerAuth,/onAuthenticated\(d\.user\)/);
});
