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


const customerAuth=await readFile(new URL("../src/CustomerAuth.tsx",import.meta.url),"utf8");
const supabaseClient=await readFile(new URL("../src/lib/supabase.ts",import.meta.url),"utf8");
const customerApp=await readFile(new URL("../src/CustomerApp.tsx",import.meta.url),"utf8");
const packageJson=JSON.parse(await readFile(new URL("../package.json",import.meta.url),"utf8"));
test("customer authentication uses a pinned Supabase client and public publishable configuration",()=>{
 assert.equal(packageJson.dependencies["@supabase/supabase-js"],"2.119.1");
 for(const term of ["VITE_SUPABASE_URL","VITE_SUPABASE_PUBLISHABLE_KEY","persistSession: true","autoRefreshToken: true","detectSessionInUrl: true","flowType: \"pkce\""])assert.ok(supabaseClient.includes(term),term);
});
test("customer auth uses Supabase sign up, sign in, verification resend and password recovery",()=>{
 for(const term of ["supabase.auth.signUp","supabase.auth.signInWithPassword","supabase.auth.resend","supabase.auth.resetPasswordForEmail","supabase.auth.updateUser","emailRedirectTo","PASSWORD_RECOVERY","signOutError"])assert.ok(customerAuth.includes(term),term);
});
test("customer dashboard derives the signed-in identity from Supabase session and signs out",()=>{
 for(const term of ["supabase.auth.getSession","supabase.auth.onAuthStateChange","supabase.auth.signOut","toAuthUser","isPasswordRecoveryRoute","/reset-password"])assert.ok(customerApp.includes(term),term);
});
test("Worker does not implement a second customer password/session store",()=>{
 for(const term of ["auth_users","auth_sessions","auth_email_tokens","/api/auth/register","AUTH_SESSION_SECONDS","RESEND_API_KEY"])assert.ok(!worker.includes(term),term);
});

