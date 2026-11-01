import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}. Добавьте её в Vercel или в .env.local.`);
  }
  return value;
}

// Секретный ключ Supabase (sb_secret_… или service_role). Только на сервере.
export function supabaseSecretKey(): string {
  const key = required("SUPABASE_SECRET_KEY").trim();
  // Частая ошибка: вставлен публичный ключ (sb_publishable_… или legacy anon). С ним сервер получает 401.
  if (key.startsWith("sb_publishable_") || jwtRole(key) === "anon") {
    throw new Error(
      "В SUPABASE_SECRET_KEY вставлен публичный ключ. Нужен секретный: Supabase → Project Settings → API Keys → Secret keys (sb_secret_…).",
    );
  }
  return key;
}

function jwtRole(key: string): string | undefined {
  const parts = key.split(".");
  if (parts.length !== 3) return undefined;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role;
  } catch {
    return undefined;
  }
}

// Токен бота из @BotFather. Нужен для проверки входа через Telegram.
export function telegramBotToken(): string {
  return required("TELEGRAM_BOT_TOKEN");
}
