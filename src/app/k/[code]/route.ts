import { getListingPathByShortCode } from "@/lib/data/listings";

// Короткая ссылка карточки для QR-кода и печати: /k/<код> → 301 на постоянный адрес карточки (раздел 4 ТЗ).
export async function GET(request: Request, { params }: RouteContext<"/k/[code]">) {
  const { code } = await params;
  const path = await getListingPathByShortCode(code);
  if (!path) return new Response("Карточка не найдена", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return Response.redirect(new URL(path, request.url), 301);
}
