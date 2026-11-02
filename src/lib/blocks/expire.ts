import { VACANCY_DEFAULT_DAYS, type ListingBlock, type ListingData, type VacancyItem } from "@/lib/blocks/types";

// Сегодняшняя дата в Израиле, "2026-11-02".
export function israelToday(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function vacancyUntil(v: VacancyItem): string {
  return v.validUntil ?? addDays(v.postedAt, VACANCY_DEFAULT_DAYS);
}

// Убирает то, что устарело к дате today (раздел 4 ТЗ): спецпредложения после срока, прошедшие мероприятия,
// вакансии после «актуально до», прошедшие исключения в часах работы. Блок без оставшихся элементов скрывается.
// Вызывается внутри кэшируемой выборки карточки, поэтому скрытие наступает в течение часа после срока.
export function pruneExpired(data: ListingData, today: string): ListingData {
  const blocks = data.blocks.map((b): ListingBlock => {
    switch (b.type) {
      case "offers": {
        const items = b.data.items.filter((o) => !o.validUntil || o.validUntil >= today);
        return { ...b, hidden: b.hidden || !items.length, data: { ...b.data, items } };
      }
      case "events": {
        const items = b.data.items
          .filter((e) => (e.end ?? e.start).slice(0, 10) >= today)
          .sort((a, c) => a.start.localeCompare(c.start));
        return { ...b, hidden: b.hidden || !items.length, data: { ...b.data, items } };
      }
      case "vacancies": {
        const items = b.data.items.filter((v) => vacancyUntil(v) >= today);
        return { ...b, hidden: b.hidden || !items.length, data: { ...b.data, items } };
      }
      case "news": {
        const posts = [...b.data.posts].sort((a, c) => c.date.localeCompare(a.date));
        return { ...b, data: { ...b.data, posts } };
      }
      case "hours": {
        const exceptions = (b.data.exceptions ?? []).filter((x) => x.date >= today).sort((a, c) => a.date.localeCompare(c.date));
        return { ...b, data: { ...b.data, exceptions } };
      }
      default:
        return b;
    }
  });
  return { ...data, blocks };
}

// Смещение часового пояса Израиля для даты: "+02:00" зимой, "+03:00" летом (для разметки Event).
export function israelOffset(localDateTime: string): string {
  const guess = new Date(`${localDateTime.length === 10 ? `${localDateTime}T12:00` : localDateTime}:00Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "+02:00";
}
