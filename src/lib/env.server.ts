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
  return required("SUPABASE_SECRET_KEY");
}

// Токен бота из @BotFather. Нужен для проверки входа через Telegram.
export function telegramBotToken(): string {
  return required("TELEGRAM_BOT_TOKEN");
}
