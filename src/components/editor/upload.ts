"use client";

import { createClient } from "@/lib/supabase/client";

// Загрузка фото и PDF (раздел 4 ТЗ, ограничения — решение 5 ноября 2026).
// Фото человек выбирает в любом привычном формате (JPEG, PNG, HEIC с iPhone и т. д.): браузер сам уменьшает его и
// переводит в WebP — две копии: большая 1600 px (просмотр, обложка) и маленькая 640 px (галерея, списки; на телефоне с плотным экраном 640 хватает плитке в полэкрана).
// В карточку записывается адрес большой копии `<id>.l.webp`; маленькая лежит рядом как `<id>.s.webp` (см. Photo).
// Если браузер не смог сжать фото, а это JPEG/PNG до 3 МБ, грузим как есть. PDF — в отдельное хранилище docs.
// Сервер (правила Supabase) всё равно проверяет тип, размер и квоту пользователя — обойти браузер не получится.

const LARGE = 1600;
const SMALL = 640;
const MAX_INPUT = 25 * 1024 * 1024; // до сжатия: фото с телефона бывают 10–20 МБ
const MAX_RAW_IMAGE = 3 * 1024 * 1024; // запасной путь без сжатия = предел хранилища media
const MAX_PDF = 10 * 1024 * 1024;

async function toWebp(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не умеет обрабатывать фото");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
  // Safari старых версий вместо WebP отдаёт PNG — такой файл не годится, идём запасным путём.
  if (!blob || blob.type !== "image/webp") throw new Error("Не удалось сжать фото");
  return blob;
}

function friendly(message: string): string {
  if (/exceeded the maximum allowed size|Payload too large|413/i.test(message)) return "Файл слишком большой";
  if (/row-level security|violates|policy|403|Unauthorized/i.test(message))
    return "Превышен лимит загрузок: не больше 300 фото и 150 МБ на человека и 60 фото в час. Удалите ненужные фото или попробуйте позже.";
  if (/mime type|not supported/i.test(message)) return "Такой формат файла не подходит";
  return message;
}

export async function uploadMedia(file: File, kind: "image" | "file" = "image"): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) throw new Error("Сначала войдите на сайт");

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
  if (kind === "image" && !isImage) throw new Error("Нужна картинка");
  if (kind === "file" && !isPdf && !isImage) throw new Error("Нужен PDF или фото");

  const id = crypto.randomUUID();
  const put = async (bucket: "media" | "docs", path: string, body: Blob, contentType: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, cacheControl: "31536000" });
    if (error) throw new Error(friendly(error.message));
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  if (isPdf) {
    if (file.size > MAX_PDF) throw new Error("PDF больше 10 МБ — сожмите файл или загрузите фото меню");
    return put("docs", `u/${uid}/${id}.pdf`, file, "application/pdf");
  }

  if (file.size > MAX_INPUT) throw new Error("Фото больше 25 МБ");
  let large: Blob | null = null;
  let small: Blob | null = null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      large = await toWebp(bitmap, LARGE, 0.82);
      small = await toWebp(bitmap, SMALL, 0.78);
    } finally {
      bitmap.close();
    }
  } catch {
    large = null;
  }

  if (large && small) {
    // Сначала маленькая копия: если большая не загрузится, лишний файл уберёт ежедневная уборка.
    await put("media", `u/${uid}/${id}.s.webp`, small, "image/webp");
    return put("media", `u/${uid}/${id}.l.webp`, large, "image/webp");
  }

  // Запасной путь: браузер не смог сжать (редкие форматы, старые браузеры).
  if ((file.type === "image/jpeg" || file.type === "image/png") && file.size <= MAX_RAW_IMAGE) {
    return put("media", `u/${uid}/${id}.${file.type === "image/png" ? "png" : "jpg"}`, file, file.type);
  }
  throw new Error("Не удалось обработать это фото. Сохраните его как JPEG (например, сделайте снимок экрана) и загрузите снова.");
}
