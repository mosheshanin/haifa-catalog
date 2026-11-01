"use client";

import { useEffect, useState } from "react";
import type { HoursInterval, WeekdayKey } from "@/lib/blocks/types";
import { t } from "@/i18n/ru";

const KEYS: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Текущий день недели и время в Израиле, независимо от часового пояса устройства.
function nowInIsrael(date = new Date()): { day: WeekdayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3) ?? "sun";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { day: (KEYS.includes(wd as WeekdayKey) ? wd : "sun") as WeekdayKey, minutes: h * 60 + m };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isOpenNow(week: Partial<Record<WeekdayKey, HoursInterval[]>>, date = new Date()): boolean {
  const { day, minutes } = nowInIsrael(date);
  return (week[day] ?? []).some((i) => {
    const open = toMinutes(i.open);
    const close = toMinutes(i.close);
    return close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close;
  });
}

// Статус считается в браузере: страница кэшируется, а время идёт.
export function OpenNowBadge({ week }: { week: Partial<Record<WeekdayKey, HoursInterval[]>> }) {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOpen(isOpenNow(week));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [week]);

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
