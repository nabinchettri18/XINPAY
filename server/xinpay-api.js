import { createClient } from "@supabase/supabase-js";

const DEFAULT_INSTRUCTIONS = "Use the payment details shown here and keep your transaction reference for your records.";

function env(name) { return process.env[name] || ""; }
function getSupabaseUrl() { return (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, ""); }
function getPublishableKey() { return env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY"); }

export function json(res, status, data) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Vary", "Origin");
  return res.status(status).json(data);
}

export function fail(res, status, message, extra = {}) {
  return json(res, status, { error: message, ...extra });
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(value) ? value[0] : value || "";
}

export function originAllowed(req) {
  const origin = getHeader(req, "origin");
  if (!origin) return true;
  const host = getHeader(req, "x-forwarded-host") || getHeader(req, "host");
  try {
    return !!host && new URL(origin).host.toLowerCase() === String(host).toLowerCase();
  } catch {
    return false;
  }
}

export function method(req, res, expected) {
  if (!originAllowed(req)) {
    fail(res, 403, "Cross-origin request rejected");
    return false;
  }
  if (req.method !== expected) {
    res.setHeader("Allow", expected);
    fail(res, 405, "Method not allowed");
    return false;
  }
  return true;
}

export function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

export function amountIsValid(value) {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= 1 && value <= 1000000 && Math.round(value * 100) === value * 100;
}
export function minor(value) { return Math.round(value * 100); }

export function randomId(prefix = "") {
  return prefix + crypto.randomUUID().replace(/-/g, "");
}
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

function newClient(token = "") {
  const url = getSupabaseUrl();
  const key = getPublishableKey();
  if (!url || !key) throw new Error("Supabase server environment is not configured.");
  const headers = token ? { Authorization: "Bearer " + token } : {};
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers },
  });
}

export function serviceClient() {
  const url = getSupabaseUrl();
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("Server-side SUPABASE_SECRET_KEY is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function context(req, { admin = false, allowAnonymous = false } = {}) {
  const authHeader = getHeader(req, "authorization");
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!token) {
    if (allowAnonymous) return { db: newClient(), user: null, token: "" };
    return { error: { status: 401, message: "Sign in is required." } };
  }
  let db;
  try { db = newClient(token); }
  catch (error) { return { error: { status: 503, message: error.message } }; }

  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return { error: { status: 401, message: "Your XinPay session is invalid or expired." } };
  const user = data.user;
  if (admin) {
    const email = String(user.email || "").trim().toLowerCase();
    if (!email) return { error: { status: 403, message: "An email-verified administrator account is required." } };
    const { data: allowed, error: allowError } = await db.rpc("is_xinpay_admin");
    if (allowError || allowed !== true) return { error: { status: 403, message: "This account is not authorised for the XinPay admin console." } };
  }
  return { db, user, token };
}

export async function rateLimit(_req, db, scope, limit = 30) {
  const { data, error } = await db.rpc("consume_rate_limit", {
    p_scope: scope,
    p_limit: limit,
  });
  if (error) throw new Error("Rate limit service is unavailable.");
  return data === true;
}

export async function publicConfig() {
  const db = newClient();
  const { data, error } = await db.from("payment_config")
    .select("receiving_upi_id,beneficiary_display_name,instructions,enabled,version,updated_at")
    .eq("id", "primary").maybeSingle();
  if (error) throw error;
  return {
    upiId: data?.receiving_upi_id || "",
    beneficiary: data?.beneficiary_display_name || "",
    instructions: data?.instructions || DEFAULT_INSTRUCTIONS,
    enabled: !!data?.enabled,
    version: Number(data?.version || 0),
    updatedAt: data?.updated_at || "",
  };
}

export function cashfreeBase() {
  return env("CASHFREE_ENV") === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}
export function cashfreeHeaders() {
  return {
    "x-client-id": env("CASHFREE_CLIENT_ID"),
    "x-client-secret": env("CASHFREE_CLIENT_SECRET"),
    "x-api-version": "2025-01-01",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}
export function paymentsEnabled() {
  return env("PAYMENTS_ENABLED") === "true" && env("CASHFREE_ENV") !== "production";
}
export function directUpiEnabled() {
  return env("DIRECT_UPI_ENABLED") === "true";
}
export function environment(name) { return env(name); }
export const defaultInstructions = DEFAULT_INSTRUCTIONS;
