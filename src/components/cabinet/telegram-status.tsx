import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { TELEGRAM_BOT_USERNAME } from "@/lib/env";

type State = "unlinked" | "no-start" | "ok";

// Может ли бот писать пользователю: Telegram привязан и «Старт» нажат (бот не заблокирован).
export async function telegramState(userId: string): Promise<State> {
  const sb = createAdminClient();
  const { data: p } = await sb.from("profiles").select("telegram_id").eq("id", userId).maybeSingle();
  if (!p?.telegram_id) return "unlinked";
  const { data: chat } = await sb.from("telegram_chats").select("blocked_at").eq("telegram_id", p.telegram_id).maybeSingle();
  return chat && !chat.blocked_at ? "ok" : "no-start";
}

const botLink = (start?: string) => `https://t.me/${TELEGRAM_BOT_USERNAME}${start ? `?start=${start}` : ""}`;

// Плашка в кабинете. Письма о заявках появятся на этапе 7 вместе с доменом (решение 2 ноября 2026).
export async function TelegramStatus({ userId, context }: { userId: string; context: "requests" | "settings" }) {
  const state = await telegramState(userId);
  if (state === "ok") {
    return context === "settings" ? (
      <p className="mb-3 text-sm">
        ✅ Telegram привязан, бот <b>@{TELEGRAM_BOT_USERNAME}</b> может вам писать.
      </p>
    ) : null;
  }
  const text =
    state === "unlinked" ? (
      <>
        📲 <b>Привяжите Telegram, чтобы получать заявки сразу</b> — с кнопками «Принять» и «Отклонить». Пока заявки видны только здесь, в кабинете.
      </>
    ) : (
      <>
        📲 <b>Нажмите «Старт» у бота @{TELEGRAM_BOT_USERNAME}</b> — без этого Telegram не разрешает боту писать вам, и заявки видны только здесь, в кабинете.
      </>
    );
  return (
    <div className="mb-4 grid gap-3 rounded-2xl bg-[#e6f4f8] p-4 text-sm">
      <p>{text}</p>
      <div className="flex flex-wrap gap-2">
        {state === "unlinked" ? (
          <Link href="/profil" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-bold text-white hover:bg-primary-hover">
            Привязать Telegram
          </Link>
        ) : (
          <a href={botLink("leads")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-bold text-white hover:bg-primary-hover">
            ✈️ Открыть бота
          </a>
        )}
      </div>
    </div>
  );
}
