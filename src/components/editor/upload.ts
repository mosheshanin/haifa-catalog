"use client";

import { createClient } from "@/lib/supabase/client";

// Загрузка фото и PDF (раздел 4 ТЗ, ограничения — решение 5 ноября 2026).
// Фото человек выбирает в любом привычном формате (JPEG, PNG, HEIC с iPhone и т. д.): браузер сам уменьшает его и
// переводит в WebP (в Safari — в JPEG) — две копии: большая 1600 px (просмотр, обложка) и маленькая 640 px (галерея, списки; на телефоне с плотным экраном 640 хватает плитке в полэкрана).
// В карточку записывается адрес большой копии `<id>.l.webp|jpg`; маленькая лежит рядом как `<id>.s.webp|jpg` (см. Photo).
// Если браузер не смог сжать фото, а это JPEG/PNG до 3 МБ, грузим как есть. PDF — в отдельное хранилище docs.
// Сервер (правила Supabase) всё равно проверяет тип, размер и квоту пользователя — обойти браузер не получится.

const LARGE = 1600;
const SMALL = 640;
const MAX_INPUT = 25 * 1024 * 1024; // до сжатия: фото с телефона бывают 10–20 МБ
const MAX_RAW_IMAGE = 3 * 1024 * 1024; // запасной путь без сжатия = предел хранилища media
const MAX_PDF = 10 * 1024 * 1024;

type Encoded = { blob: Blob; ext: "webp" | "jpg"; type: string };

// Сжать до maxSide по длинной стороне. WebP умеют Chrome, Edge, Firefox и Android; Safari (iPhone, Mac) вместо WebP
// отдаёт PNG — тогда сжимаем в JPEG, его умеют все браузеры.
async function encode(bitmap: ImageBitmap, maxSide: number, quality: number, prefer: "webp" | "jpg"): Promise<Encoded> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не умеет обрабатывать фото");
  if (prefer === "jpg") {
    ctx.fillStyle = "#fff"; // у JPEG нет прозрачности: прозрачный фон PNG станет белым, а не чёрным
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  const toBlob = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
  if (prefer === "webp") {
    const webp = await toBlob("image/webp");
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", type: "image/webp" };
    throw new Error("no-webp");
  }
  const jpg = await toBlob("image/jpeg");
  if (!jpg || jpg.type !== "image/jpeg") throw new Error("Не удалось сжать фото");
  return { blob: jpg, ext: "jpg", type: "image/jpeg" };
}

async function compress(bitmap: ImageBitmap): Promise<{ large: Encoded; small: Encoded }> {
  try {
    return { large: await encode(bitmap, LARGE, 0.82, "webp"), small: await encode(bitmap, SMALL, 0.78, "webp") };
  } catch {
    return { large: await encode(bitmap, LARGE, 0.82, "jpg"), small: await encode(bitmap, SMALL, 0.78, "jpg") };
  }
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
  let copies: { large: Encoded; small: Encoded } | null = null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      copies = await compress(bitmap);
    } finally {
      bitmap.close();
    }
  } catch {
    copies = null;
  }

  if (copies) {
    // Сначала маленькая копия: если большая не загрузится, лишний файл уберёт ежедневная уборка.
    const { large, small } = copies;
    await put("media", `u/${uid}/${id}.s.${small.ext}`, small.blob, small.type);
    return put("media", `u/${uid}/${id}.l.${large.ext}`, large.blob, large.type);
  }

  // Запасной путь: браузер не смог сжать (редкие форматы, старые браузеры).
  if ((file.type === "image/jpeg" || file.type === "image/png") && file.size <= MAX_RAW_IMAGE) {
    return put("media", `u/${uid}/${id}.${file.type === "image/png" ? "png" : "jpg"}`, file, file.type);
  }
  throw new Error("Не удалось обработать это фото. Сохраните его как JPEG (например, сделайте снимок экрана) и загрузите снова.");
}
