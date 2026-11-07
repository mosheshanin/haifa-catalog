// Спецпредложения: вид предложения и как его показывать (7 ноября 2026, просьба заказчика).
//
// Раньше у предложения были «Цена» и «Скидка, %» без пояснения, и бесплатная диагностика «вместо 266 ₪» выглядела
// на сайте как «−100% · … 266 ₪». Теперь владелец сначала выбирает вид (`kind`), и от вида зависят поля редактора
// (`showIf` в схеме) и надписи: плашка («Бесплатно», «−20%», «Спеццена», «Подарок»), цена по акции и зачёркнутая
// обычная цена. Старые записи без `kind` переводит `normalizeOffer` (sanitize, карточка, Telegram, разметка).
// Модуль без серверных зависимостей: его берут карточка, редактор, Telegram и JSON-LD.
import type { OfferItem, OfferKind } from "@/lib/blocks/types";
import { formatPrice } from "@/lib/format";

export const OFFER_KINDS: Array<{ value: OfferKind; label: string }> = [
  { value: "discount", label: "Скидка в процентах" },
  { value: "price", label: "Специальная цена" },
  { value: "free", label: "Бесплатно — консультация, диагностика, пробное занятие" },
  { value: "gift", label: "Подарок к покупке или визиту" },
  { value: "other", label: "Другое — опишу словами" },
];

const KIND_SET = new Set<string>(OFFER_KINDS.map((k) => k.value));
export const isOfferKind = (v: unknown): v is OfferKind => typeof v === "string" && KIND_SET.has(v);

/** Вид предложения и поля без противоречий. Старые записи: −100% → «Бесплатно» (их «Цена» была обычной ценой),
 *  скидка → «Скидка», только цена → «Специальная цена», ничего → «Другое». */
export function normalizeOffer(o: OfferItem): OfferItem {
  let kind: OfferKind;
  const { price, discountPercent } = o;
  let { oldPrice } = o;
  if (isOfferKind(o.kind)) kind = o.kind;
  else if (discountPercent === 100) {
    kind = "free";
    oldPrice = oldPrice ?? price;
  } else if (discountPercent) kind = "discount";
  else if (price !== undefined) kind = "price";
  else kind = "other";

  if (kind === "free") return { ...o, kind, price: undefined, discountPercent: undefined, oldPrice: positive(oldPrice) };
  if (kind === "discount") {
    // Скидка 100% — это «Бесплатно»
    if (discountPercent === 100) return normalizeOffer({ ...o, kind: "free", oldPrice: oldPrice ?? price });
    return { ...o, kind, price: undefined, discountPercent, oldPrice: positive(oldPrice) };
  }
  if (kind === "price") {
    const old = positive(oldPrice) !== undefined && price !== undefined && oldPrice! > price ? oldPrice : undefined;
    if (price === 0) return normalizeOffer({ ...o, kind: "free", oldPrice: old });
    return { ...o, kind, price, discountPercent: undefined, oldPrice: old };
  }
  return { ...o, kind, price: undefined, discountPercent: undefined, oldPrice: undefined };
}

const positive = (n: number | undefined) => (n !== undefined && n > 0 ? n : undefined);

export type OfferDeal = {
  kind: OfferKind;
  /** Плашка у заголовка: «Бесплатно», «−20%», «Спеццена», «Подарок»; у «Другого» нет */
  badge?: string;
  /** Цена по акции: «213 ₪» (у «Бесплатно» нет — слово уже в плашке) */
  now?: string;
  /** Обычная цена (зачёркнутая) */
  was?: string;
  /** Число для разметки поисковиков (Offer.price) */
  priceValue?: number;
};

export function offerDeal(raw: OfferItem): OfferDeal {
  const o = normalizeOffer(raw);
  const was = o.oldPrice !== undefined ? formatPrice(o.oldPrice) : undefined;
  switch (o.kind) {
    case "free":
      // «Бесплатно» уже в плашке; в строке цены — только «Обычная цена 266 ₪» (зачёркнутая)
      return { kind: "free", badge: "Бесплатно", was, priceValue: 0 };
    case "discount": {
      const value = o.oldPrice !== undefined && o.discountPercent ? Math.round(o.oldPrice * (1 - o.discountPercent / 100)) : undefined;
      return {
        kind: "discount",
        badge: o.discountPercent ? `−${o.discountPercent}%` : "Скидка",
        now: value !== undefined ? formatPrice(value) : undefined,
        was: value !== undefined ? was : undefined,
        priceValue: value,
      };
    }
    case "price": {
      const pct = o.oldPrice !== undefined && o.price !== undefined ? Math.round((1 - o.price / o.oldPrice) * 100) : 0;
      return {
        kind: "price",
        badge: pct >= 1 ? `−${pct}%` : "Спеццена",
        now: o.price !== undefined ? formatPrice(o.price) : undefined,
        was,
        priceValue: o.price,
      };
    }
    case "gift":
      return { kind: "gift", badge: "Подарок" };
    default:
      return { kind: "other" };
  }
}

/** Короткая строка для Telegram и подписей: «бесплатно, вместо 266 ₪», «−20%: 213 ₪ вместо 266 ₪», «подарок». */
export function offerSummary(raw: OfferItem): string {
  const d = offerDeal(raw);
  if (d.kind === "free") return d.was ? `бесплатно, вместо ${d.was}` : "бесплатно";
  if (d.kind === "gift") return "подарок";
  if (d.kind === "other") return "";
  const head = d.badge && d.badge.startsWith("−") ? d.badge : "";
  const price = d.now ? (d.was ? `${d.now} вместо ${d.was}` : d.now) : "";
  return [head, price].filter(Boolean).join(": ");
}
