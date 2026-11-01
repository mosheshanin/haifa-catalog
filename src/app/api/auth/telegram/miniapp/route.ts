import { NextResponse, type NextRequest } from "next/server";
import { verifyMiniAppInitData } from "@/lib/telegram/verify";
import { telegramBotToken } from "@/lib/env.server";
import { signInWithTelegram } from "@/lib/auth/telegram-session";

// Автоматический вход в Mini App: страница присылает Telegram.WebApp.initData,
// сервер проверяет подпись Telegram и открывает сессию.
export async function POST(request: NextRequest) {
  let initData: unknown;
  try {
    ({ initData } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (typeof initData !== "string" || initData.length === 0 || initData.length > 8192) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  let verified;
  try {
    verified = verifyMiniAppInitData(initData, telegramBotToken());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const startParam = verified.startParam ?? "";
  const linkToken = startParam.startsWith("link_") ? startParam.slice(5) : undefined;

  try {
    const result = await signInWithTelegram(verified.user, linkToken);
    return NextResponse.json({ ok: true, linked: result.linked });
  } catch (e) {
    console.error("telegram miniapp auth", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
