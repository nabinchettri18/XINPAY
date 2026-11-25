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
const customerOrders = await read("api/customer/orders.js");
const paymentConfigClient = await read("src/paymentConfig.ts");
const paymentSettings = await read("src/PaymentSettings.tsx");
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

test("Only the separate admin path opens the protected admin console", () => {
  assert.ok(main.includes('path === "/admin24776543"'));
  assert.ok(!main.includes('path === "/admin"'));
  assert.ok(!main.includes('path.startsWith("/admin/")'));
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
  assert.ok(paymentConfig.includes('auth.db.rpc("admin_update_payment_config_with_qr"'));
});

test("Customer orders are bound to the authenticated Supabase identity", () => {
  assert.ok(directOrders.includes("auth.user.id"));
  assert.ok(directOrders.includes("customer_access_hash"));
  assert.ok(orderStatus.includes('req.headers["x-order-token"]'));
  assert.ok(orderStatus.includes("auth.db.from(\"payment_orders\")"));
  assert.ok(customerApp.includes('"X-Order-Token": token'));
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


test("Customer payment history reads only the signed-in customer's own orders", () => {
  assert.ok(customerOrders.includes('context(req)'));
  assert.ok(customerOrders.includes('.from("payment_orders")'));
  assert.ok(customerOrders.includes('.eq("customer_id", auth.user.id)'));
  assert.ok(customerOrders.includes('.limit(100)'));
  assert.ok(!customerOrders.includes("serviceClient"));
  assert.ok(!customerOrders.includes("customer_access_hash"));
  assert.ok(customerApp.includes('apiFetch("/api/customer/orders"'));
});
test("Customer dashboard contains no invented balance, merchant transactions, dummy card or demo labels", () => {
  for (const phrase of ["₹12,450.00", "₹3,500.00", "Cafe Coffee Day", "Metro recharge", "DEMO", "Demo environment", "Prototype / sample data", "4821"]) {
    assert.ok(!customerApp.includes(phrase), phrase);
  }
  assert.ok(customerApp.includes("Total requests"));
  assert.ok(customerApp.includes("Completed"));
  assert.ok(customerApp.includes("Awaiting confirmation"));
  assert.ok(customerApp.includes("orders.map"));
});


const qrConfigApi=await read("api/payment-config.js");
const paymentServer=await read("server/xinpay-api.js");
test("Admin can upload a QR image and update the UPI destination through the dashboard",()=>{
  assert.ok(paymentSettings.includes('storage.from(BUCKET).upload'));
  assert.ok(paymentSettings.includes('crypto.randomUUID()'));
  assert.ok(paymentSettings.includes('accept="image/png,image/jpeg,image/webp"') || paymentSettings.includes('accept="image/png,image/jpeg,image/webp"'));
  assert.ok(qrConfigApi.includes('context(req, { admin: true })'));
  assert.ok(qrConfigApi.includes('admin_update_payment_config_with_qr'));
  assert.ok(qrConfigApi.includes("QR_KEY_PATTERN"));
  assert.ok(paymentServer.includes("qr_asset_key,qr_mode"));
  assert.ok(paymentServer.includes("storagePublicUrl("));
  assert.ok(paymentConfigClient.includes("qrAssetUrl"));
});
test("Customer payment screen refreshes saved QR settings and displays the uploaded image",()=>{
  assert.ok(customerApp.includes("window.setInterval(refresh, 20000)"));
  assert.ok(customerApp.includes('directOrder?.qrMode === "uploaded" && directOrder?.qrAssetUrl'));
  assert.ok(customerApp.includes('className="xc-customer-qr"'));
});


test("Admin can change the receiving UPI ID and QR image without redeploying", () => {
  assert.ok(paymentConfig.includes('context(req, { admin: true })'));
  assert.ok(paymentConfig.includes('auth.db.rpc("admin_update_payment_config_with_qr"'));
  assert.ok(paymentConfig.includes("p_qr_asset_key"));
  assert.ok(paymentConfig.includes("p_qr_mode"));
  assert.ok(server.includes('storagePublicUrl("xinpay-payment-qr"'));
  assert.ok(paymentSettings.includes('const BUCKET = "xinpay-payment-qr"'));
  assert.ok(paymentSettings.includes('storage.from(BUCKET).upload'));
  assert.ok(paymentSettings.includes('payment-qr/qr-"+crypto.randomUUID()'));
  assert.ok(paymentSettings.includes('upsert:false'));
  assert.ok(paymentSettings.includes("MAX_QR_BYTES = 1024 * 1024"));
  assert.ok(paymentSettings.includes('image/png'));
  assert.ok(paymentSettings.includes('image/jpeg'));
  assert.ok(paymentSettings.includes('image/webp'));
  assert.ok(paymentConfigClient.includes('channel("xinpay-payment-config")'));
  assert.ok(paymentConfigClient.includes('table: "payment_config"'));
  assert.ok(customerApp.includes('directOrder?.qrAssetUrl'));
  assert.ok(customerApp.includes('directOrder?.upiId'));
});

