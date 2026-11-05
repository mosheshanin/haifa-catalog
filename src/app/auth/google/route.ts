import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/current-user";
import { finishGoogleSignIn } from "@/lib/auth/google-finish";

// Вход через окно Google на самом сайте (Google Identity Services). Браузер присылает подписанный
// Google токен (credential) и одноразовое число (nonce); Supabase проверяет подпись, адресата
// (Client ID должен быть в настройках провайдера Google) и nonce, затем ставит cookie сессии.
// Путь под /auth — чтобы сюда доходила cookie «Привязать Google» (она ставится с path=/auth).
export async function POST(request: NextRequest) {
  let body: { credential?: unknown; nonce?: unknown; next?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { credential, nonce } = body;
  if (typeof credential !== "string" || typeof nonce !== "string" || credential.length > 8000 || nonce.length > 200) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const next = safeNext(typeof body.next === "string" ? body.next : undefined);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
  if (error || !data.user) {
    console.error("auth/google", error?.message);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const redirect = await finishGoogleSignIn(data.user, next);
  return NextResponse.json({ ok: true, redirect });
}
