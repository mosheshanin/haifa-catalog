import { webhookCallback } from "grammy";
import { telegramBotTokenOptional } from "@/lib/env.server";
import { webhookSecret } from "@/lib/telegram/api";
import { createBot } from "@/lib/telegram/bot";

// Вебхук бота: Telegram присылает сюда сообщения, нажатия кнопок и встроенный поиск (раздел 7 ТЗ, grammY).
// Подлинность проверяется секретом в заголовке; адрес и секрет ставятся кнопкой в админке → «Telegram».
export const maxDuration = 30;

let handler: { token: string; fn: (req: Request) => Promise<Response> } | null = null;

export async function POST(request: Request) {
  const token = telegramBotTokenOptional();
  if (!token) return new Response("Бот не настроен", { status: 503 });
  if (handler?.token !== token) {
    handler = { token, fn: webhookCallback(createBot(token), "std/http", { secretToken: webhookSecret(token), onTimeout: "return", timeoutMilliseconds: 25_000 }) };
  }
  return handler.fn(request);
}
