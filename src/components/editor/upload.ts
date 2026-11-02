"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_SIDE = 2000;
const MAX_BYTES = 10 * 1024 * 1024;

// Уменьшить фото до 2000 px по длинной стороне и сжать в WebP прямо в браузере (раздел 4 ТЗ).
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не умеет обрабатывать фото");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.82));
  if (!blob) throw new Error("Не удалось сжать фото");
  return blob;
}

// Загрузка в хранилище Supabase в папку пользователя u/<id>/ (правила доступа разрешают писать только туда).
export async function uploadMedia(file: File, kind: "image" | "file" = "image"): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("Файл больше 10 МБ");
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) throw new Error("Сначала войдите на сайт");
  const isPdf = file.type === "application/pdf";
  if (kind === "image" && !file.type.startsWith("image/")) throw new Error("Нужна картинка");
  if (kind === "file" && !isPdf && !file.type.startsWith("image/")) throw new Error("Нужен PDF или фото");
  const body = isPdf ? file : await toWebp(file);
  const ext = isPdf ? "pdf" : "webp";
  const path = `u/${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, body, { contentType: isPdf ? "application/pdf" : "image/webp", cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}
