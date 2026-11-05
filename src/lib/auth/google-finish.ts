import "server-only";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeLinkToken } from "@/lib/auth/link-tokens";
import { mergeProfiles } from "@/lib/auth/telegram-session";
import { LINK_GOOGLE_COOKIE } from "@/lib/auth/constants";

/**
 * Общий конец входа через Google (и через окно Google на сайте, и через прежний возврат /auth/callback):
 * обновить email Google и роль администратора, а если человек нажал «Привязать Google» в профиле,
 * созданном через Telegram, — перенести тот профиль сюда. Возвращает адрес, куда вести дальше.
 */
export async function finishGoogleSignIn(user: User, next: string): Promise<string> {
  const admin = createAdminClient();
  try {
    if (user.email) {
      await admin.rpc("sync_google_identity", { p_user_id: user.id, p_email: user.email });
    }

    const cookieStore = await cookies();
    const linkToken = cookieStore.get(LINK_GOOGLE_COOKIE)?.value;
    if (linkToken) {
      cookieStore.delete({ name: LINK_GOOGLE_COOKIE, path: "/auth" });
      const telegramProfileId = await consumeLinkToken(linkToken, "link_google");
      if (telegramProfileId && telegramProfileId !== user.id) {
        await mergeProfiles(user.id, telegramProfileId);
        return "/profil?linked=google";
      }
    }
  } catch (e) {
    console.error("finishGoogleSignIn", e);
    return "/profil?error=link";
  }
  return next;
}
