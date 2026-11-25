import { supabase } from "./supabase";

/** XinPay's application API is hosted by Vercel Functions on the same origin. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : "/" + path;
  return normalized.startsWith("/api/") ? normalized : "/api" + normalized;
}

/**
 * Adds the current Supabase bearer token to same-origin Vercel Function calls.
 * Explicit headers (for example X-Order-Token) are preserved.
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
    credentials: "same-origin",
    cache: init.cache ?? "no-store",
  });
}
