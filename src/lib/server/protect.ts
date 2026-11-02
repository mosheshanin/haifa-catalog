import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { turnstileSecret } from "@/lib/env.server";
import { ActionError } from "@/lib/server/session";

// IP посетителя за прокси Vercel.
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

// Ограничение частоты: не больше limit отправок за windowSec по ключу (IP или пользователь).
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const { data, error } = await createAdminClient().rpc("rate_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSec });
  if (error) throw error;
  if (data === false) throw new ActionError("Слишком много отправок подряд. Попробуйте позже.");
}

// Проверка Cloudflare Turnstile на сервере. Пока секретный ключ не задан — пропускаем (раздел 2 ТЗ: капча + частота).
export async function verifyCaptcha(token: FormDataEntryValue | null) {
  const secret = turnstileSecret();
  if (!secret) return;
  if (typeof token !== "string" || !token) throw new ActionError("Подтвердите, что вы не робот.");
  const body = new URLSearchParams({ secret, response: token, remoteip: await clientIp() });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const json = (await res.json()) as { success?: boolean };
  if (!json.success) throw new ActionError("Проверка «не робот» не прошла. Обновите страницу и попробуйте ещё раз.");
}

// Скрытое поле-ловушка для ботов: люди его не видят и не заполняют.
export function honeypot(form: FormData) {
  if (String(form.get("website_url") ?? "").trim()) throw new ActionError("Отправка отклонена.");
}
