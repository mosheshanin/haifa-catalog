// Импорт стартовых карточек из таблицы (раздел 6 ТЗ): разбор CSV и строк шаблона. Работает и в браузере, и на сервере.

export const IMPORT_COLUMNS = [
  { k: "section", h: "раздел", hint: "бизнес или специалист", required: true },
  { k: "category", h: "категория", hint: "название или адрес категории/подкатегории", required: true },
  { k: "districts", h: "район", hint: "один или несколько через запятую", required: true },
  { k: "title", h: "название", hint: "для специалиста — имя и первая буква фамилии", required: true },
  { k: "profession", h: "профессия", hint: "только для специалистов" },
  { k: "slogan", h: "слоган", hint: "" },
  { k: "address", h: "адрес", hint: "улица, дом, город" },
  { k: "phone", h: "телефон", hint: "" },
  { k: "whatsapp", h: "whatsapp", hint: "" },
  { k: "telegram", h: "telegram", hint: "ник без @" },
  { k: "email", h: "email", hint: "" },
  { k: "website", h: "сайт", hint: "https://…" },
  { k: "instagram", h: "instagram", hint: "ник" },
  { k: "facebook", h: "facebook", hint: "ссылка" },
  { k: "hours", h: "часы", hint: "Вс-Чт 09:00-18:00; Пт 09:00-13:00" },
  { k: "description", h: "описание", hint: "" },
  { k: "languages", h: "языки", hint: "через запятую" },
  { k: "features", h: "особенности", hint: "через запятую" },
  { k: "photos", h: "фото", hint: "ссылки через пробел, до 10" },
  { k: "cover", h: "обложка", hint: "ссылка на фото" },
  { k: "google", h: "google_карты", hint: "ссылка на место в Google Картах" },
] as const;

export type ImportRow = { line: number } & Partial<Record<(typeof IMPORT_COLUMNS)[number]["k"], string>>;

// CSV по RFC 4180: кавычки, переносы строк внутри ячеек; разделитель — запятая, точка с запятой или табуляция.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ",": (firstLine.match(/,/g) ?? []).length, ";": (firstLine.match(/;/g) ?? []).length, "\t": (firstLine.match(/\t/g) ?? []).length };
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",") as string;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function rowsFromCsv(text: string): { rows: ImportRow[]; unknownHeaders: string[] } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], unknownHeaders: [] };
  const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const keyOf = header.map((h) => IMPORT_COLUMNS.find((c) => c.h === h || c.k === h)?.k);
  const unknownHeaders = header.filter((_, i) => !keyOf[i]);
  const rows = table.slice(1).map((cells, idx) => {
    const r: ImportRow = { line: idx + 2 };
    cells.forEach((c, i) => {
      const k = keyOf[i];
      if (k && c.trim()) r[k] = c.trim();
    });
    return r;
  });
  return { rows: rows.slice(0, 500), unknownHeaders };
}

// «Вс-Чт 09:00-18:00; Пт 09:00-13:00» → неделя в формате блока «Часы работы».
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_RU: Record<string, number> = { вс: 0, пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6 };
export function parseHours(s: string | undefined): { week: Record<string, Array<{ open: string; close: string }>>; ok: boolean } {
  const week: Record<string, Array<{ open: string; close: string }>> = {};
  if (!s) return { week, ok: true };
  let ok = true;
  for (const part of s.split(";").map((p) => p.trim()).filter(Boolean)) {
    const m = part.toLowerCase().match(/^([а-я]{2})(?:\s*[-–]\s*([а-я]{2}))?\s+(.+)$/);
    if (!m || !(m[1] in DAY_RU) || (m[2] && !(m[2] in DAY_RU))) {
      ok = false;
      continue;
    }
    const intervals = [...m[3].matchAll(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g)].map((x) => ({
      open: `${x[1].padStart(2, "0")}:${x[2]}`,
      close: `${x[3].padStart(2, "0")}:${x[4]}`,
    }));
    if (!intervals.length) {
      if (!/выходн|закрыт/.test(m[3])) ok = false;
      continue;
    }
    const from = DAY_RU[m[1]];
    const to = m[2] ? DAY_RU[m[2]] : from;
    for (let d = from; ; d = (d + 1) % 7) {
      week[DAY_KEYS[d]] = intervals;
      if (d === to) break;
    }
  }
  return { week, ok };
}

export const splitList = (s?: string) => (s ?? "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
export const splitUrls = (s?: string) => (s ?? "").split(/\s+/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x)).slice(0, 10);
