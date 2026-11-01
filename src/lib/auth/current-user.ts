import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  isBlocked: boolean;
  googleEmail: string | null;
  telegramUsername: string | null;
  hasGoogle: boolean;
  hasTelegram: boolean;
};

// Текущий пользователь по cookie сессии. Читает запрос, поэтому вызывается
// только внутри <Suspense> (раздел про Cache Components в документации Next.js).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, is_blocked, google_email, telegram_id, telegram_username")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    displayName: profile.display_name || profile.google_email || profile.telegram_username || "Пользователь",
    avatarUrl: profile.avatar_url,
    role: profile.role,
    isBlocked: profile.is_blocked,
    googleEmail: profile.google_email,
    telegramUsername: profile.telegram_username,
    hasGoogle: Boolean(profile.google_email),
    hasTelegram: profile.telegram_id !== null,
  };
}

// Безопасный внутренний адрес для перенаправления после входа.
export function safeNext(next: string | null | undefined, fallback = "/profil"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
