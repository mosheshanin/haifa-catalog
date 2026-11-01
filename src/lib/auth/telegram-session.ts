import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TelegramUser } from "@/lib/telegram/verify";
import { consumeLinkToken } from "@/lib/auth/link-tokens";

// Служебный адрес для профилей, созданных через Telegram. Домен .invalid зарезервирован:
// письмо на такой адрес никогда никуда не уйдёт.
export function telegramServiceEmail(telegramId: number): string {
  return `tg-${telegramId}@telegram.invalid`;
}

export function telegramDisplayName(u: TelegramUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username || "Пользователь Telegram";
}

async function findProfileByTelegramId(admin: SupabaseClient, telegramId: number) {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

async function createTelegramUser(admin: SupabaseClient, u: TelegramUser): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: telegramServiceEmail(u.id),
    email_confirm: true,
    // app_metadata пользователь изменить не может — триггер берёт telegram_id только отсюда.
    app_metadata: {
      telegram_id: String(u.id),
      telegram_name: telegramDisplayName(u),
      telegram_username: u.username ?? null,
      telegram_photo: u.photo_url ?? null,
    },
  });
  if (error || !data.user) throw error ?? new Error("Не удалось создать пользователя Telegram");
  return data.user.id;
}

/**
 * Объединяет профиль removeId в keepId и удаляет пользователя removeId.
 */
export async function mergeProfiles(keepId: string, removeId: string) {
  if (keepId === removeId) return;
  const admin = createAdminClient();
  const { error } = await admin.rpc("merge_profiles", { p_keep: keepId, p_remove: removeId });
  if (error) throw error;
  const { error: delError } = await admin.auth.admin.deleteUser(removeId);
  if (delError) throw delError;
}

/**
 * Привязывает Telegram к профилю keepId. Если у этого Telegram уже был отдельный профиль,
 * он объединяется с keepId.
 */
export async function attachTelegramToProfile(keepId: string, u: TelegramUser) {
  const admin = createAdminClient();
  const existing = await findProfileByTelegramId(admin, u.id);
  if (existing && existing !== keepId) {
    await mergeProfiles(keepId, existing);
  }
  const { error } = await admin
    .from("profiles")
    .update({ telegram_id: u.id, telegram_username: u.username ?? null })
    .eq("id", keepId);
  if (error) throw error;
}

/**
 * Создаёт сессию Supabase (cookie) для указанного пользователя без пароля:
 * сервер выпускает одноразовую ссылку и сразу сам её подтверждает. Письмо не отправляется.
 */
async function startSessionFor(userId: string) {
  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData.user?.email) throw userError ?? new Error("У пользователя нет служебного email");

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkError || !link.properties?.hashed_token) throw linkError ?? new Error("Не удалось выпустить ссылку входа");

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpError) throw otpError;
}

/**
 * Вход через Telegram (Mini App или виджет на сайте).
 * linkToken — одноразовый токен «Открыть в Telegram» из профиля на сайте.
 */
export async function signInWithTelegram(u: TelegramUser, linkToken?: string): Promise<{ userId: string; linked: boolean }> {
  const admin = createAdminClient();

  if (linkToken) {
    const ownerId = await consumeLinkToken(linkToken, "link_telegram");
    if (ownerId) {
      await attachTelegramToProfile(ownerId, u);
      await startSessionFor(ownerId);
      return { userId: ownerId, linked: true };
    }
  }

  let userId = await findProfileByTelegramId(admin, u.id);
  if (!userId) {
    userId = await createTelegramUser(admin, u);
  } else if (u.username) {
    await admin.from("profiles").update({ telegram_username: u.username }).eq("id", userId);
  }

  await startSessionFor(userId);
  return { userId, linked: false };
}
