import { supabase } from "./supabase";

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE = (configuredBase || "https://xinpay.nabinchettri0007.workers.dev").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return API_BASE + (path.startsWith("/") ? path : "/" + path);
}

/**
 * Calls the XinPay Worker API and attaches the current Supabase access token
 * when one exists. Explicit Authorization headers (such as per-order tokens)
 * are preserved.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  if (!headers.has("Authorization") && supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(apiUrl(path), {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
}
