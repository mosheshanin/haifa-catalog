import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeLinkToken } from "@/lib/auth/link-tokens";
import { mergeProfiles } from "@/lib/auth/telegram-session";
import { safeNext } from "@/lib/auth/current-user";
import { LINK_GOOGLE_COOKIE } from "@/lib/auth/constants";

// Возврат после входа через Google.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const fail = new URL(`/vhod?error=google&next=${encodeURIComponent(next)}`, url.origin);

  if (!code) return NextResponse.redirect(fail);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(fail);

  const user = data.user;
  const admin = createAdminClient();

  try {
    // Обновить email Google и роль администратора (если адрес в списке администраторов).
    if (user.email && user.app_metadata?.provider === "google") {
      await admin.rpc("sync_google_identity", { p_user_id: user.id, p_email: user.email });
    }

    // «Привязать Google» из профиля, созданного через Telegram: переносим тот профиль сюда.
    const cookieStore = await cookies();
    const linkToken = cookieStore.get(LINK_GOOGLE_COOKIE)?.value;
    if (linkToken) {
      cookieStore.delete(LINK_GOOGLE_COOKIE);
      const telegramProfileId = await consumeLinkToken(linkToken, "link_google");
      if (telegramProfileId && telegramProfileId !== user.id) {
        await mergeProfiles(user.id, telegramProfileId);
        return NextResponse.redirect(new URL("/profil?linked=google", url.origin));
      }
    }
  } catch (e) {
    console.error("auth/callback", e);
    return NextResponse.redirect(new URL("/profil?error=link", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
