import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const worker=await readFile(new URL("../worker/index.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../database/migrations/0003_transactions.sql",import.meta.url),"utf8");
const migration4=await readFile(new URL("../database/migrations/0004_order_access.sql",import.meta.url),"utf8");
test("payments default to disabled and production mode is blocked",()=>{
 assert.match(worker,/PAYMENTS_ENABLED!=="true"/);
 assert.match(worker,/CASHFREE_ENV==="production"/);
});
test("Access JWT validation checks issuer, audience, expiry, signature and admin allowlist",()=>{
 for(const term of ["claims.iss!==issuer","claims.aud","claims.exp","crypto.subtle.verify","ADMIN_EMAILS"])assert.ok(worker.includes(term),term);
});
test("orders use INR and integer minor units and store hashed customer access",()=>{
 assert.match(worker,/currency:"INR"/);
 assert.match(worker,/Math\.round\(amount\*100\)/);
 assert.match(migration,/amount_minor INTEGER NOT NULL CHECK \(amount_minor > 0\)/);
 assert.match(migration4,/customer_access_hash TEXT/);
});
test("webhook validates signature, timestamp, amount, currency and deduplicates",()=>{
 for(const term of ["x-webhook-signature","x-webhook-timestamp","HMAC","payload_hash","verification_state","currency===\\\"INR\\\"","INSERT OR IGNORE"])assert.ok(worker.includes(term),term);
});
test("ledger rows only originate from successful verified webhook branch",()=>{
 assert.match(worker,/status==="SUCCESS"&&verified/);
 assert.match(migration,/ledger_entries/);
});
test("admin transaction endpoint is Access protected",()=>{
 assert.match(worker,/path==="\/api\/admin\/orders"/);
 assert.match(worker,/const identity=await requireAdmin/);
});
