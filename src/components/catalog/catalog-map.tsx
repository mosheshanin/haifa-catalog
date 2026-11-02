"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { ListingListItem, type ListItemData } from "@/components/listing/listing-list-item";
import { insideTelegram } from "@/components/telegram/use-inside-telegram";

// Карта каталога (раздел 5 ТЗ): MapLibre + бесплатные тайлы OpenFreeMap, метки с группировкой,
// карточка-превью при нажатии на метку.

export type MapItem = ListItemData & {
  lat: number;
  lng: number;
  subtitle: string;
  districtLabel: string;
};

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
// Воркер MapLibre лежит у нас (scripts/copy-maplibre-worker.mjs): сборщик не кладёт его рядом с кодом.
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const HAIFA: [number, number] = [34.99, 32.8];
// Цвета из globals.css (--color-primary, --color-accent)
const PRIMARY = "#1e1b4b"; // основной цвет сайта (логотип)
const ACCENT = "#c2410c";

const LOCALE = {
  "NavigationControl.ZoomIn": "Приблизить",
  "NavigationControl.ZoomOut": "Отдалить",
  "NavigationControl.ResetBearing": "Повернуть на север",
  "GeolocateControl.FindMyLocation": "Где я",
  "GeolocateControl.LocationNotAvailable": "Местоположение недоступно",
  "AttributionControl.ToggleAttribution": "Источники карты",
  "AttributionControl.MapFeedback": "Сообщить об ошибке на карте",
  "Map.Title": "Карта",
  "Popup.Close": "Закрыть",
  "CooperativeGesturesHandler.WindowsHelpText": "Чтобы изменить масштаб, крутите колесо с нажатой Ctrl",
  "CooperativeGesturesHandler.MacHelpText": "Чтобы изменить масштаб, крутите колесо с нажатой ⌘",
  "CooperativeGesturesHandler.MobileHelpText": "Двигайте карту двумя пальцами",
};

type Maplibre = typeof import("maplibre-gl");
let loader: Promise<Maplibre> | null = null;

export function loadMaplibre(): Promise<Maplibre> {
  loader ??= import("maplibre-gl").then((m) => {
    const lib = ((m as unknown as { default?: Maplibre }).default ?? m) as Maplibre;
    lib.setWorkerUrl(WORKER_URL);
    return lib;
  });
  return loader;
}

// Подписи на карте по-русски, где они есть в OpenStreetMap, иначе по-английски, иначе как есть.
export function localizeLabels(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== "symbol") continue;
    const field = map.getLayoutProperty(layer.id, "text-field");
    if (field && JSON.stringify(field).includes('"name')) {
      map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name:ru"], ["get", "name_en"], ["get", "name"]]);
    }
  }
}

// Шрифт для цифр на группах меток берём из самой карты: у тайлов свой набор шрифтов.
function styleFont(map: MapLibreMap): string[] {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== "symbol") continue;
    const font = map.getLayoutProperty(layer.id, "text-font");
    if (Array.isArray(font) && font.every((f) => typeof f === "string")) {
      const bold = (font as string[]).map((f) => f.replace("Regular", "Bold"));
      return bold;
    }
  }
  return ["Noto Sans Bold"];
}

// В Telegram свайп вниз закрывает приложение — пока карта на экране, отключаем его.
export function useTelegramSwipeLock() {
  useEffect(() => {
    if (!insideTelegram()) return;
    const wa = window.Telegram?.WebApp;
    wa?.disableVerticalSwipes?.();
    return () => wa?.enableVerticalSwipes?.();
  }, []);
}

export function CatalogMap({ items, missing }: { items: MapItem[]; missing: number }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useTelegramSwipeLock();

  const itemsKey = items.map((i) => i.id).join(",");

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    loadMaplibre()
      .then((lib) => {
        if (cancelled || !box.current) return;
        map = new lib.Map({
          container: box.current,
          style: MAP_STYLE,
          center: HAIFA,
          zoom: 11.5,
          minZoom: 8,
          maxZoom: 18,
          cooperativeGestures: true,
          attributionControl: { compact: true },
          locale: LOCALE,
        });
        mapRef.current = map;
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");

        map.on("error", (e) => console.warn("[map]", e.error?.message));

        map.on("load", () => {
          if (!map) return;
          localizeLabels(map);
          map.addSource("listings", {
            type: "geojson",
            cluster: true,
            clusterRadius: 48,
            clusterMaxZoom: 15,
            promoteId: "id",
            data: {
              type: "FeatureCollection",
              features: items.map((i) => ({
                type: "Feature",
                properties: { id: i.id, offer: i.has_offer ? 1 : 0 },
                geometry: { type: "Point", coordinates: [i.lng, i.lat] },
              })),
            },
          });
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "listings",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": PRIMARY,
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 30],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            },
          });
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "listings",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": styleFont(map), "text-size": 14 },
            paint: { "text-color": "#ffffff" },
          });
          map.addLayer({
            id: "points",
            type: "circle",
            source: "listings",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ["case", ["boolean", ["feature-state", "selected"], false], ACCENT, PRIMARY],
              "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 13, 10],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            },
          });

          if (items.length === 1) {
            map.jumpTo({ center: [items[0].lng, items[0].lat], zoom: 15 });
          } else if (items.length > 1) {
            const lngs = items.map((i) => i.lng);
            const lats = items.map((i) => i.lat);
            map.fitBounds(
              [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ],
              { padding: 56, maxZoom: 15, duration: 0 },
            );
          }

          map.on("click", "clusters", async (e: MapLayerMouseEvent) => {
            const f = e.features?.[0];
            const clusterId = f?.properties?.cluster_id as number | undefined;
            if (!map || clusterId === undefined || f?.geometry.type !== "Point") return;
            const zoom = await (map.getSource("listings") as GeoJSONSource).getClusterExpansionZoom(clusterId);
            map.easeTo({ center: f.geometry.coordinates as [number, number], zoom });
          });
          map.on("click", "points", (e: MapLayerMouseEvent) => {
            const id = e.features?.[0]?.properties?.id as string | undefined;
            if (id) setSelected(id);
          });
          map.on("click", (e) => {
            if (!map) return;
            const hit = map.queryRenderedFeatures(e.point, { layers: ["points", "clusters"] });
            if (!hit.length) setSelected(null);
          });
          for (const layer of ["clusters", "points"]) {
            map.on("mouseenter", layer, () => map && (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", layer, () => map && (map.getCanvas().style.cursor = ""));
          }
        });
      })
      .catch((err) => {
        console.warn("[map]", err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // Набор меток меняется вместе с адресом страницы — тогда карта создаётся заново.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  // Подсветка выбранной метки
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("listings")) return;
    map.removeFeatureState({ source: "listings" });
    if (selected) map.setFeatureState({ source: "listings", id: selected }, { selected: true });
  }, [selected]);

  const current = items.find((i) => i.id === selected);

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-primary-soft">
        <div ref={box} className="h-[60vh] min-h-80 w-full" role="region" aria-label="Карта с найденными карточками" />
        {failed ? (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted">
            🗺️ Карта сейчас не загрузилась. Обновите страницу или переключитесь на список.
          </p>
        ) : null}
        {current ? (
          <div className="absolute inset-x-2 bottom-8 z-10 sm:inset-x-auto sm:left-3 sm:w-[26rem]">
            <div className="relative">
              <ListingListItem listing={current} subtitle={current.subtitle} districtLabel={current.districtLabel} />
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute -right-1 -top-3 z-20 grid size-8 place-items-center rounded-full border border-line bg-white text-sm font-bold shadow"
                aria-label="Закрыть превью"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-sm text-muted">
        {items.length ? "Нажмите на метку, чтобы увидеть карточку. " : "На карте пока нет карточек с адресом. "}
        {missing > 0
          ? `${missing} без адреса на карте не показаны — обычно это специалисты с выездом; они есть в списке.`
          : null}
      </p>
    </div>
  );
}
