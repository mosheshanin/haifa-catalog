"use client";

import { useEffect, useState } from "react";
import type { HoursException, HoursInterval, WeekdayKey } from "@/lib/blocks/types";
import { t } from "@/i18n/ru";

const KEYS: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Текущий день недели и время в Израиле, независимо от часового пояса устройства.
function nowInIsrael(date = new Date()): { day: WeekdayKey; minutes: number; isoDate: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3) ?? "sun";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: (KEYS.includes(wd as WeekdayKey) ? wd : "sun") as WeekdayKey,
    minutes: h * 60 + m,
    isoDate: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

type Week = Partial<Record<WeekdayKey, HoursInterval[]>> & { exceptions?: HoursException[] };

// Исключение на сегодня (праздник, короткий день) важнее обычного расписания.
export function isOpenNow(week: Week, date = new Date(), exceptions: HoursException[] = week.exceptions ?? []): boolean {
  const { day, minutes, isoDate } = nowInIsrael(date);
  const today = exceptions.find((x) => x.date === isoDate);
  const intervals = today ? (today.closed ? [] : (today.intervals ?? [])) : (week[day] ?? []);
  return intervals.some((i) => {
    const open = toMinutes(i.open);
    const close = toMinutes(i.close);
    return close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close;
  });
}

// Статус считается в браузере: страница кэшируется, а время идёт.
export function OpenNowBadge({ week, exceptions }: { week: Week; exceptions?: HoursException[] }) {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOpen(isOpenNow(week, new Date(), exceptions ?? week.exceptions ?? []));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [week, exceptions]);

  if (open === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        open ? "bg-[#e5f4e4] text-success" : "bg-[#f3f4f6] text-muted"
      }`}
    >
      <span className={`size-2 rounded-full ${open ? "bg-success" : "bg-muted"}`} aria-hidden />
      {open ? t.listing.openNow : t.listing.closedNow}
    </span>
  );
}
