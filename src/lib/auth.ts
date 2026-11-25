import type { User } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export function toAuthUser(user: User | null): AuthUser | null {
  if (!user || !(user.email_confirmed_at || user.confirmed_at)) return null;
  const fullName = user.user_metadata?.full_name;
  return {
    id: user.id,
    name:
      typeof fullName === "string" && fullName.trim()
        ? fullName.trim()
        : user.email?.split("@")[0] || "XinPay customer",
    email: user.email || "",
    emailVerifiedAt: user.email_confirmed_at || user.confirmed_at || null,
    createdAt: user.created_at,
  };
}
