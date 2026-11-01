"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MAP_STYLE, loadMaplibre, localizeLabels } from "@/components/catalog/catalog-map";

// Маленькая карта с одной меткой в блоке «Адрес» карточки.
// Загружается, только когда блок доходит до экрана: карточка открывается быстро (Core Web Vitals).
export function PlaceMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;
    loadMaplibre()
      .then((lib) => {
        if (cancelled || !box.current) return;
        map = new lib.Map({
          container: box.current,
          style: MAP_STYLE,
          center: [lng, lat],
          zoom: 15.5,
          cooperativeGestures: true,
          attributionControl: { compact: true },
          locale: {
            "NavigationControl.ZoomIn": "Приблизить",
            "NavigationControl.ZoomOut": "Отдалить",
            "AttributionControl.ToggleAttribution": "Источники карты",
            "CooperativeGesturesHandler.WindowsHelpText": "Чтобы изменить масштаб, крутите колесо с нажатой Ctrl",
            "CooperativeGesturesHandler.MacHelpText": "Чтобы изменить масштаб, крутите колесо с нажатой ⌘",
            "CooperativeGesturesHandler.MobileHelpText": "Двигайте карту двумя пальцами",
          },
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        new lib.Marker({ color: "#0a5f6b" }).setLngLat([lng, lat]).addTo(map);
        map.on("load", () => map && localizeLabels(map));
        map.on("error", (e) => console.warn("[map]", e.error?.message));
      })
      .catch((err) => {
        console.warn("[map]", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [visible, lat, lng]);

  return (
    <div className="relative mt-3 overflow-hidden rounded-2xl border border-line bg-primary-soft">
      <div ref={box} className="aspect-[16/9] w-full sm:aspect-[16/7]" role="region" aria-label={`Карта: ${label}`} />
      {failed ? (
        <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted">🗺️ Карта не загрузилась</p>
      ) : null}
    </div>
  );
}
