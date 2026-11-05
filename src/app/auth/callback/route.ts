import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/current-user";
import { finishGoogleSignIn } from "@/lib/auth/google-finish";

// Возврат после входа через Google по прежней схеме (переход через сервер Supabase).
// Основной вход теперь — окно Google на сайте (/auth/google); этот путь остаётся запасным.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const fail = new URL(`/vhod?error=google&next=${encodeURIComponent(next)}`, url.origin);

  if (!code) return NextResponse.redirect(fail);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(fail);

  const target = data.user.app_metadata?.provider === "google" ? await finishGoogleSignIn(data.user, next) : next;
  return NextResponse.redirect(new URL(target, url.origin));
}
