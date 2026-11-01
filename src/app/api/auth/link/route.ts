import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createLinkToken } from "@/lib/auth/link-tokens";
import { LINK_GOOGLE_COOKIE } from "@/lib/auth/constants";
import { miniAppLink } from "@/lib/env";

// Одноразовые ссылки привязки.
// { target: "telegram" } → ссылка на Mini App, при открытии Telegram привяжется к этому профилю.
// { target: "google" }   → cookie на 10 минут; после входа через Google профили объединятся.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let target: unknown;
  try {
    ({ target } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  if (target === "telegram") {
    const token = await createLinkToken(userId, "link_telegram");
    return NextResponse.json({ ok: true, url: miniAppLink(`link_${token}`) });
  }

  if (target === "google") {
    const token = await createLinkToken(userId, "link_google");
    const cookieStore = await cookies();
    cookieStore.set(LINK_GOOGLE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/auth",
      maxAge: 10 * 60,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
}
