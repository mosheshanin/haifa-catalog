"use server";

import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ActionError, audit, requireUser, runAction, type ActionResult } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/protect";
import { notifyAdmins } from "@/lib/telegram/notify";

// «Удалить аккаунт» (раздел 9 ТЗ, решение 2 ноября 2026, раздел 14):
// — отзывы остаются без имени автора («Бывший пользователь»);
// — в заявках у владельцев стираются имя и контакт (сама заявка остаётся в их статистике);
// — карточки отвязываются от владельца и остаются опубликованными, ими управляет администратор;
// — избранное, заявки на права и привязка Telegram удаляются (каскадом вместе с профилем).
export async function deleteAccount(_: unknown, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    await rateLimit(`delete-account:${user.id}`, 3, 3600);
    if (String(form.get("confirm") ?? "").trim().toLowerCase() !== "удалить") {
      throw new ActionError("Напишите слово «удалить», чтобы подтвердить.");
    }
    if (user.role === "admin") {
      throw new ActionError("Администратор не может удалить свой аккаунт сам: сначала другой администратор снимает с него роль.");
    }
    const sb = createAdminClient();
    const { data: owned } = await sb.from("listings").select("id, title").eq("owner_id", user.id);

    const steps = await Promise.all([
      sb.from("reviews").update({ author_name: "Бывший пользователь" }).eq("user_id", user.id),
      sb.from("requests").update({ name: "Удалённый пользователь", contact: "удалён", comment: null }).eq("user_id", user.id),
      sb.from("complaints").update({ contact: null }).eq("user_id", user.id),
      user.telegramId ? sb.from("telegram_chats").delete().eq("telegram_id", user.telegramId) : Promise.resolve({ error: null }),
    ]);
    const failed = steps.find((s) => s.error);
    if (failed?.error) throw failed.error;

    // Удаление пользователя каскадом удаляет профиль, избранное и токены; ссылки в карточках, отзывах и заявках обнуляются.
    const { error } = await sb.auth.admin.deleteUser(user.id);
    if (error) throw error;
    await audit(null, "account.deleted", "profile", user.id, { listings: (owned ?? []).map((l) => l.id) });

    if (owned?.length) {
      notifyAdmins(
        `🗑 Владелец удалил аккаунт. Карточки остались без владельца: ${owned.map((l) => `«${l.title ?? "без названия"}»`).join(", ")}.`,
        "/admin?tab=listings",
      );
    }
    // Сессия удалённого пользователя больше не действует — убираем cookie входа.
    await (await createClient()).auth.signOut({ scope: "local" }).catch(() => undefined);
    updateTag("listings");
  }, "Аккаунт удалён.");
}
