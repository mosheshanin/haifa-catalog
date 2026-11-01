import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";
import { supabaseSecretKey } from "@/lib/env.server";

// Клиент с секретным ключом: обходит правила RLS. Только для серверного кода,
// который сам проверил права (вход через Telegram, объединение профилей, служебные задачи).
export function createAdminClient() {
  return createClient(SUPABASE_URL, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
