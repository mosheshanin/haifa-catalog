import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Ежедневная уборка хранилища (решение заказчика 5 ноября 2026): файлы старше 7 дней, которых нет ни в одной
// версии карточки (опубликованной, черновике, на проверке, старой), удаляются. Черновики и их фото не трогаем.
// Список даёт SQL orphan_media; удаление — через Storage API (удалить строку в storage.objects нельзя: файл останется).
export async function cleanupOrphanMedia(days = 7): Promise<number> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc("orphan_media", { p_days: days, p_limit: 500 });
  if (error) {
    console.error("cleanupOrphanMedia", error.message);
    return 0;
  }
  const rows = (data ?? []) as { bucket_id: string; name: string }[];
  let removed = 0;
  for (const bucket of new Set(rows.map((r) => r.bucket_id))) {
    const names = rows.filter((r) => r.bucket_id === bucket).map((r) => r.name);
    for (let i = 0; i < names.length; i += 100) {
      const { data: gone, error: e } = await sb.storage.from(bucket).remove(names.slice(i, i + 100));
      if (e) console.error("cleanupOrphanMedia remove", bucket, e.message);
      else removed += gone?.length ?? 0;
    }
  }
  return removed;
}
