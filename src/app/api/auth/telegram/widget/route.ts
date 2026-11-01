import { NextResponse, type NextRequest } from "next/server";
import { verifyLoginWidget } from "@/lib/telegram/verify";
import { telegramBotToken } from "@/lib/env.server";
import { signInWithTelegram } from "@/lib/auth/telegram-session";
import { safeNext } from "@/lib/auth/current-user";

// Возврат из виджета «Войти через Telegram» на сайте.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const next = safeNext(query.next);

  let user;
  try {
    user = verifyLoginWidget(query, telegramBotToken());
  } catch {
    return NextResponse.redirect(new URL(`/vhod?error=telegram&next=${encodeURIComponent(next)}`, url.origin));
  }

  try {
    await signInWithTelegram(user);
  } catch (e) {
    console.error("telegram widget auth", e);
    return NextResponse.redirect(new URL(`/vhod?error=telegram&next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
