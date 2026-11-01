"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ListingListItem, type ListItemData } from "@/components/listing/listing-list-item";
import { MapPinIcon } from "@/components/icons";

type Row = ListItemData & { district_ids: number[]; category_id: number | null; summary: string | null };

type TgLocationManager = {
  isInited: boolean;
  isLocationAvailable: boolean;
  init: (cb?: () => void) => void;
  getLocation: (cb: (data: { latitude: number; longitude: number } | null) => void) => void;
};

// Геопозиция: в Telegram — через встроенный механизм Mini App, в браузере — стандартный запрос.
// Координаты используются только для сортировки и не сохраняются (раздел 9 ТЗ).
function getPosition(): Promise<{ lat: number; lng: number }> {
  const lm = (window as unknown as { Telegram?: { WebApp?: { LocationManager?: TgLocationManager } } }).Telegram?.WebApp?.LocationManager;
  if (lm) {
    return new Promise((resolve, reject) => {
      const ask = () =>
        lm.isLocationAvailable
          ? lm.getLocation((d) => (d ? resolve({ lat: d.latitude, lng: d.longitude }) : reject(new Error("denied"))))
          : reject(new Error("unavailable"));
      if (lm.isInited) ask();
      else lm.init(ask);
    });
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unavailable"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  });
}

export function NearMe({
  districts,
  categories,
}: {
  districts: Array<{ id: number; slug: string; name: string }>;
  categories: Array<{ id: number; name: string }>;
}) {
  const [state, setState] = useState<"idle" | "locating" | "loading" | "done" | "denied" | "error">("idle");
  const [rows, setRows] = useState<Row[]>([]);
  const districtName = (id: number) => districts.find((d) => d.id === id)?.name ?? "";
  const categoryName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "";

  async function locate() {
    setState("locating");
    try {
      const pos = await getPosition();
      setState("loading");
      const { data, error } = await createClient().rpc("search_listings", {
        p_lat: pos.lat,
        p_lng: pos.lng,
        p_sort: "distance",
        p_limit: 30,
      });
      if (error) throw error;
      setRows((data ?? []) as Row[]);
      setState("done");
    } catch (e) {
      const code = (e as GeolocationPositionError)?.code;
      setState(code === 1 || (e as Error)?.message === "denied" || (e as Error)?.message === "unavailable" ? "denied" : "error");
    }
  }

  return (
    <div className="grid gap-5">
      {state === "idle" || state === "locating" || state === "loading" ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-center">
          <p className="text-4xl" aria-hidden>📍</p>
          <p className="mt-2 font-bold">Покажем, что ближе к вам</p>
          <p className="mt-1 text-sm text-muted">Ваше местоположение используется только для сортировки и нигде не сохраняется.</p>
          <button
            type="button"
            onClick={locate}
            disabled={state !== "idle"}
            className="mt-4 inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-bold text-white hover:bg-primary-hover disabled:opacity-70"
          >
            <MapPinIcon className="size-5" />
            {state === "idle" ? "Определить, где я" : state === "locating" ? "Определяем…" : "Ищем рядом…"}
          </button>
        </div>
      ) : null}

      {state === "denied" || state === "error" ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
          <p className="font-bold">
            {state === "denied" ? "Не удалось узнать ваше местоположение." : "Что-то пошло не так. Попробуйте ещё раз."}
          </p>
          <p className="mt-1 text-sm text-muted">Выберите район вручную:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {districts.map((d) => (
              <li key={d.id}>
                <Link href={`/poisk?district=${d.slug}`} className="block rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:border-primary hover:bg-primary-soft">
                  📍 {d.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state === "done" ? (
        rows.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((l) => (
              <ListingListItem
                key={l.id}
                listing={l}
                subtitle={l.section === "specialisty" && l.summary ? l.summary : categoryName(l.category_id)}
                districtLabel={l.district_ids.map(districtName).filter(Boolean).slice(0, 2).join(", ")}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-center text-muted">Рядом пока никого нет.</p>
        )
      ) : null}
    </div>
  );
}
