import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
};

export type VerifiedMiniAppData = {
  user: TelegramUser;
  authDate: number;
  startParam?: string;
};

const MAX_AGE_SECONDS = 24 * 60 * 60;

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function checkFreshness(authDate: number, now: number) {
  if (!Number.isFinite(authDate) || authDate <= 0) throw new Error("telegram: нет auth_date");
  if (now - authDate > MAX_AGE_SECONDS) throw new Error("telegram: данные устарели");
  if (authDate - now > 300) throw new Error("telegram: дата из будущего");
}

/**
 * Проверка данных запуска Mini App (Telegram.WebApp.initData).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyMiniAppInitData(
  initData: string,
  botToken: string,
  now = Math.floor(Date.now() / 1000),
): VerifiedMiniAppData {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("telegram: нет подписи");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(hash, expected)) throw new Error("telegram: подпись не совпадает");

  const authDate = Number(params.get("auth_date"));
  checkFreshness(authDate, now);

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("telegram: нет пользователя");
  const user = JSON.parse(userRaw) as TelegramUser;
  if (!Number.isSafeInteger(user.id)) throw new Error("telegram: неверный id");

  return { user, authDate, startParam: params.get("start_param") ?? undefined };
}

const WIDGET_FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date"] as const;

/**
 * Проверка данных виджета «Войти через Telegram» на сайте.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyLoginWidget(
  query: Record<string, string | undefined>,
  botToken: string,
  now = Math.floor(Date.now() / 1000),
): TelegramUser {
  const hash = query.hash;
  if (!hash) throw new Error("telegram: нет подписи");

  const dataCheckString = WIDGET_FIELDS.filter((k) => query[k] !== undefined)
    .map((k) => `${k}=${query[k]}`)
    .sort()
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(hash, expected)) throw new Error("telegram: подпись не совпадает");

  checkFreshness(Number(query.auth_date), now);

  const id = Number(query.id);
  if (!Number.isSafeInteger(id)) throw new Error("telegram: неверный id");

  return {
    id,
    first_name: query.first_name ?? "",
    last_name: query.last_name,
    username: query.username,
    photo_url: query.photo_url,
  };
}
