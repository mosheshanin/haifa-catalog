import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SessionUser = {
  id: string;
  role: "user" | "admin";
  isBlocked: boolean;
  displayName: string;
  googleEmail: string | null;
  telegramId: number | null;
};

// Пользователь текущего запроса (серверные действия и обработчики маршрутов). Профиль читается секретным
// клиентом, чтобы роль нельзя было подменить; сама личность берётся из проверенного токена сессии.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const { data: p } = await createAdminClient()
    .from("profiles")
    .select("id, role, is_blocked, display_name, google_email, telegram_id, telegram_username")
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;
  return {
    id: p.id,
    role: p.role,
    isBlocked: p.is_blocked,
    displayName: p.display_name || p.telegram_username || p.google_email || "Пользователь",
    googleEmail: p.google_email,
    telegramId: p.telegram_id,
  };
}

export class ActionError extends Error {}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ActionError("Нужно войти на сайт.");
  if (user.isBlocked) throw new ActionError("Ваш аккаунт заблокирован.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ActionError("Недостаточно прав.");
  return user;
}

// Результат серверного действия для форм: без исключений наружу.
export type ActionResult<T = unknown> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export async function runAction<T>(fn: () => Promise<T>, okMessage?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message: okMessage };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    // Перенаправления и служебные исключения Next.js пробрасываем дальше.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: "Что-то пошло не так. Попробуйте ещё раз." };
  }
}

// Запись в журнал действий (раздел 6).
export async function audit(actorId: string | null, action: string, entityType: string, entityId: string, details: object = {}) {
  await createAdminClient().from("audit_log").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details });
}
