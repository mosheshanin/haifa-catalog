import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Сессия нужна только личным разделам и обработчикам входа.
// Публичные страницы каталога остаются статичными и быстрыми.
export const config = {
  matcher: ["/profil/:path*", "/kabinet/:path*", "/admin/:path*", "/vhod/:path*", "/auth/:path*", "/api/:path*"],
};
