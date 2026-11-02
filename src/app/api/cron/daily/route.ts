import { connection } from "next/server";
import { israelToday } from "@/lib/blocks/expire";
import { sendDigest } from "@/lib/telegram/channel";
import { sendReminders } from "@/lib/telegram/requests";

// Ежедневная задача Vercel Cron (vercel.json, около 9:00 по Израилю): напоминания о принятых заявках на завтра,
// по воскресеньям — недельный дайджест канала. Обе части повторно ничего не отправляют, поэтому лишний вызов безвреден.
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
  return Response.json({ reminders, digest });
}
