import { connection } from "next/server";
import { israelToday } from "@/lib/blocks/expire";
import { sendDigest } from "@/lib/telegram/channel";
import { sendReminders } from "@/lib/telegram/requests";
import { sendFreshnessReminders } from "@/lib/telegram/freshness";
import { cleanupOrphanMedia } from "@/lib/server/media-cleanup";
import { expireDrafts, sendDraftReminders } from "@/lib/telegram/drafts";

// Ежедневная задача Vercel Cron (vercel.json, около 9:00 по Израилю): напоминания о принятых заявках на завтра,
// по воскресеньям — недельный дайджест канала; напоминания владельцам подтвердить данные (180 дней, этап 5);
// брошенные черновики: напоминание через 27 дней, удаление через 30; уборка файлов, которых нет ни в одной карточке
// дольше 7 дней (после удаления черновиков, чтобы их фото ушли в следующий раз). Обе части повторно ничего не отправляют, поэтому лишний вызов безвреден.
// Если в Vercel задан CRON_SECRET, Vercel присылает его в заголовке Authorization — тогда проверяем.
export const maxDuration = 60;

export async function GET(request: Request) {
  await connection(); // только во время запроса, не при сборке
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Нет доступа", { status: 401 });
  }
  const reminders = await sendReminders();
  const isSunday = new Date(`${israelToday()}T12:00:00Z`).getUTCDay() === 0;
  const digest = isSunday ? await sendDigest() : 0;
  const freshness = await sendFreshnessReminders();
  const draftReminders = await sendDraftReminders();
  const draftsRemoved = await expireDrafts();
  const mediaRemoved = await cleanupOrphanMedia(7);
  return Response.json({ reminders, digest, freshness, draftReminders, draftsRemoved, mediaRemoved });
}
