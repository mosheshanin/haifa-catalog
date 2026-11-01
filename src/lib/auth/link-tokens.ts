import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type LinkPurpose = "link_telegram" | "link_google";

const TTL_MINUTES = 10;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Одноразовый токен (в базе хранится только его хэш).
export async function createLinkToken(userId: string, purpose: LinkPurpose): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin.from("link_tokens").insert({
    token_hash: hashToken(token),
    user_id: userId,
    purpose,
    expires_at: new Date(Date.now() + TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) throw error;
  return token;
}

// Возвращает владельца токена и помечает токен использованным. Чужой, просроченный
// или повторный токен даёт null.
export async function consumeLinkToken(token: string, purpose: LinkPurpose): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id")
    .maybeSingle();
  if (error) throw error;
  return (data?.user_id as string | undefined) ?? null;
}
