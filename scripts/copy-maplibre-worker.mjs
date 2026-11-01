// MapLibre 6 загружает воркер отдельным файлом рядом со своим модулем. Сборщик Next.js этот файл
// не копирует, поэтому кладём его в public/ и указываем адрес через setWorkerUrl
// (src/components/catalog/catalog-map.tsx). Запускается после npm install и перед сборкой.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const to = join(root, "public/maplibre/maplibre-gl-worker.mjs");
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("maplibre worker → public/maplibre/");
