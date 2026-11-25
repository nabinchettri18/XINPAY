import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

const server = await read("server/xinpay-api.js");
const main = await read("src/main.tsx");
const apiClient = await read("src/lib/api.ts");
const adminGate = await read("src/AdminGate.tsx");
const adminSession = await read("api/admin/session.js");
const adminOrders = await read("api/admin/orders.js");
const verifyUpi = await read("api/admin/orders/[id]/verify-direct-upi.js");
const paymentConfig = await read("api/payment-config.js");
const directOrders = await read("api/direct-upi/orders.js");
const cashfreeOrders = await read("api/orders.js");
const orderStatus = await read("api/orders/[id].js");
const cashfreeWebhook = await read("api/webhooks/cashfree.js");
const customerApp = await read("src/CustomerApp.tsx");
const dashboard = await read("src/App.tsx");
const buildWorkflow = await read(".github/workflows/build.yml");

test("Vercel API Functions are the only application API base", () => {
  assert.ok(apiClient.includes('return normalized.startsWith("/api/") ? normalized : "/api" + normalized'));
  assert.ok(apiClient.includes('credentials: "same-origin"'));
  assert.ok(!apiClient.includes("workers.dev"));
  assert.ok(!server.includes("CF_ACCESS"));
});

test("Admin route is gated by Supabase Auth and a server-side allowlist check", () => {
  assert.ok(main.includes("<AdminGate><App /></AdminGate>"));
  assert.ok(adminGate.includes("supabase.auth.signInWithPassword"));
  assert.ok(adminGate.includes("/api/admin/session"));
  assert.ok(adminSession.includes("context(req, { admin: true })"));
  assert.ok(server.includes("auth.getUser(token)"));
  assert.ok(server.includes('db.rpc("is_xinpay_admin")'));
});

test("Admin transaction reads and manual reconciliation use RLS-scoped Supabase requests", () => {
  assert.ok(adminOrders.includes('context(req, { admin: true })'));
  assert.ok(adminOrders.includes('.from("payment_orders")'));
  assert.ok(verifyUpi.includes('context(req, { admin: true })'));
  assert.ok(verifyUpi.includes('auth.db.rpc("admin_verify_direct_upi"'));
  assert.ok(verifyUpi.includes("confirmBankCredit"));
  assert.ok(verifyUpi.includes("verifiedAmount"));
});

test("Payment settings require admin authorization for writes and keep public reads limited", () => {
  assert.ok(paymentConfig.includes('req.method === "GET"'));
  assert.ok(paymentConfig.includes('req.method === "PUT"'));
  assert.ok(paymentConfig.includes('context(req, { admin: true })'));
  assert.ok(paymentConfig.includes('auth.db.rpc("admin_update_payment_config"'));
});

test("Customer orders are bound to the authenticated Supabase identity", () => {
  assert.ok(directOrders.includes("auth.user.id"));
  assert.ok(directOrders.includes("customer_access_hash"));
  assert.ok(orderStatus.includes('req.headers["x-order-token"]'));
  assert.ok(orderStatus.includes("auth.db.from(\"payment_orders\")"));
  assert.ok(customerApp.includes('"X-Order-Token":token'));
});

test("Cashfree and Direct UPI stay disabled unless explicit server feature flags are set", () => {
  assert.ok(cashfreeOrders.includes("paymentsEnabled()"));
  assert.ok(cashfreeOrders.includes('environment("CASHFREE_ENV") === "production"'));
  assert.ok(directOrders.includes("directUpiEnabled()"));
  assert.ok(server.includes('env("PAYMENTS_ENABLED") === "true"'));
  assert.ok(server.includes('env("DIRECT_UPI_ENABLED") === "true"'));
});

test("Cashfree webhook is signature-verified and requires server-side storage credentials", () => {
  assert.ok(cashfreeWebhook.includes("CASHFREE_WEBHOOK_SECRET"));
  assert.ok(cashfreeWebhook.includes('name: "HMAC"'));
  assert.ok(cashfreeWebhook.includes("constantTimeEqual"));
  assert.ok(cashfreeWebhook.includes("serviceClient()"));
  assert.ok(server.includes("SUPABASE_SECRET_KEY"));
});

test("Admin sign-out is available in the dashboard", () => {
  assert.ok(dashboard.includes("supabase?.auth.signOut()"));
});

test("Cloudflare deployment and D1 worker runtime are removed from the active project", async () => {
  await assert.rejects(access(new URL("../.github/workflows/deploy.yml", import.meta.url)));
  await assert.rejects(access(new URL("../wrangler.toml", import.meta.url)));
  await assert.rejects(access(new URL("../worker/index.ts", import.meta.url)));
  assert.ok(!buildWorkflow.includes("wrangler"));
  assert.ok(!buildWorkflow.toLowerCase().includes("cloudflare"));
});

test("API rate limiting is database-backed and scoped to the authenticated Supabase user",()=>{
  assert.ok(server.includes('db.rpc("consume_rate_limit"'));
  assert.ok(!server.includes("localRateBuckets"));
});


const publicLanding=await read("src/LandingPage.tsx");
test("Public landing page uses concise copy and omits prototype/demo disclaimers",()=>{
 assert.ok(publicLanding.includes("Payments made"));
 assert.ok(publicLanding.includes("Get started with XINPAY"));
 assert.ok(publicLanding.includes("Create an account"));
 for(const phrase of ["Prototype environment","No live payment","No live payment or bank balance","CUSTOMER PAYMENT EXPERIENCE","A simpler way to stay in control"])assert.ok(!publicLanding.includes(phrase),phrase);
 assert.ok(!publicLanding.includes("xlp-feature-card"));
 assert.ok(!publicLanding.includes("xlp-preview-card"));
});
