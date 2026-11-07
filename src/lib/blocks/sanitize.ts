import { FREE_LIMITS, type Limits, type ListingBlock, type ListingData, type WeekdayKey } from "@/lib/blocks/types";
import { KUPOT_LIST } from "@/lib/catalog/filter-config";
import { isGoogleMapsUrl, isMediaUrl, parseGoogleMapsUrl, safeHref } from "@/lib/blocks/links";
import { isOfferKind, normalizeOffer } from "@/lib/blocks/offers";

// Проверка и очистка данных карточки, пришедших из редактора (на сервере, перед сохранением).
// Всё неизвестное отбрасывается, строки обрезаются, ссылки и фото проверяются.

type Ctx = { limits: Limits; districts: Set<string>; categoryIds: Set<number>; errors: string[] };

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\u0000/g, "").trim();
  return t ? t.slice(0, max) : undefined;
};
const num = (v: unknown, min = 0, max = 1e7): number | undefined => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : undefined;
};
const bool = (v: unknown) => v === true || v === "true";
const arr = <T>(v: unknown, max: number, fn: (x: unknown) => T | undefined): T[] =>
  (Array.isArray(v) ? v : []).slice(0, max).map(fn).filter((x): x is T => x !== undefined);
const media = (v: unknown) => (isMediaUrl(v) ? v : undefined);
const link = (v: unknown) => {
  const s = str(v, 500);
  return s && /^https?:\/\//i.test(s) ? safeHref(s) : undefined;
};
const date = (v: unknown) => {
  const s = str(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
};
const time = (v: unknown) => {
  const s = str(v, 5);
  return s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : undefined;
};
const datetime = (v: unknown) => {
  const s = str(v, 16);
  return s && /^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d)?$/.test(s) ? s : undefined;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const DAYS: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Телефон Израиля в формат +972…
export function normalizePhone(v: unknown): string | undefined {
  const s = str(v, 30);
  if (!s) return undefined;
  let d = s.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `972${d.slice(1)}`;
  return /^\d{8,15}$/.test(d) ? `+${d}` : undefined;
}

function intervals(v: unknown) {
  return arr(v, 4, (x) => {
    const o = obj(x);
    const open = time(o.open);
    const close = time(o.close);
    return open && close ? { open, close } : undefined;
  });
}

function block(raw: unknown, ctx: Ctx): ListingBlock | undefined {
  const b = obj(raw);
  const id = str(b.id, 40)?.replace(/[^\w-]/g, "");
  const d = obj(b.data);
  const hidden = bool(b.hidden) || undefined;
  if (!id) return undefined;
  const L = ctx.limits;
  switch (b.type) {
    case "description": {
      const text = str(d.text, 5000);
      return text ? { id, type: "description", hidden, data: { text } } : undefined;
    }
    case "address": {
      const address = str(d.address, 200);
      if (!address) return undefined;
      return {
        id,
        type: "address",
        hidden,
        data: { address, howToGet: str(d.howToGet, 300), parking: str(d.parking, 200), lat: num(d.lat, 29, 34), lng: num(d.lng, 34, 36) },
      };
    }
    case "service_area":
      return {
        id,
        type: "service_area",
        hidden,
        data: {
          districtSlugs: arr(d.districtSlugs, 30, (x) => (typeof x === "string" && ctx.districts.has(x) ? x : undefined)),
          formats: arr(d.formats, 3, (x) => (x === "at_home" || x === "on_site" || x === "online" ? x : undefined)),
        },
      };
    case "hours": {
      // «Всегда» и «По запросу» (3 ноября 2026): расписание по дням не нужно.
      const mode = d.mode === "always" || d.mode === "on_request" ? d.mode : undefined;
      if (mode === "always") {
        const allDay = Object.fromEntries(DAYS.map((day) => [day, [{ open: "00:00", close: "00:00" }]]));
        return { id, type: "hours", hidden, data: { week: allDay, mode, note: str(d.note, 200) } };
      }
      if (mode === "on_request") return { id, type: "hours", hidden, data: { week: {}, mode, note: str(d.note, 200) } };
      const week: Partial<Record<WeekdayKey, { open: string; close: string }[]>> = {};
      const w = obj(d.week);
      for (const day of DAYS) {
        const iv = intervals(w[day]);
        if (iv.length) week[day] = iv;
      }
      const exceptions = arr(d.exceptions, 60, (x) => {
        const o = obj(x);
        const dt = date(o.date);
        if (!dt) return undefined;
        const iv = intervals(o.intervals);
        return { date: dt, closed: bool(o.closed) || !iv.length || undefined, intervals: iv.length ? iv : undefined, note: str(o.note, 120) };
      });
      return { id, type: "hours", hidden, data: { week, exceptions: exceptions.length ? exceptions : undefined, note: str(d.note, 200) } };
    }
    case "services":
      return {
        id,
        type: "services",
        hidden,
        data: {
          groups: arr(d.groups, 20, (g) => {
            const o = obj(g);
            const items = arr(o.items, L.listItems, (x) => {
              const i = obj(x);
              const name = str(i.name, 150);
              return name
                ? { name, description: str(i.description, 300), price: num(i.price), priceFrom: bool(i.priceFrom) || undefined, durationMin: num(i.durationMin, 1, 1440) }
                : undefined;
            });
            return items.length ? { title: str(o.title, 100) ?? "Услуги", items } : undefined;
          }),
        },
      };
    case "offers":
      return {
        id,
        type: "offers",
        hidden,
        data: {
          items: arr(d.items, 20, (x) => {
            const o = obj(x);
            const title = str(o.title, 150);
            return title
              ? normalizeOffer({
                  title,
                  kind: isOfferKind(o.kind) ? o.kind : undefined,
                  description: str(o.description, 400),
                  price: num(o.price),
                  oldPrice: num(o.oldPrice),
                  discountPercent: num(o.discountPercent, 1, 100),
                  promoCode: str(o.promoCode, 30),
                  validUntil: date(o.validUntil),
                })
              : undefined;
          }),
        },
      };
    case "gallery":
      return {
        id,
        type: "gallery",
        hidden,
        data: { photos: arr(d.photos, L.gallery, (x) => (media(obj(x).url) ? { url: obj(x).url as string, caption: str(obj(x).caption, 150) } : undefined)) },
      };
    case "before_after":
      return {
        id,
        type: "before_after",
        hidden,
        data: {
          pairs: arr(d.pairs, L.before_after, (x) => {
            const o = obj(x);
            return media(o.beforeUrl) && media(o.afterUrl)
              ? { beforeUrl: o.beforeUrl as string, afterUrl: o.afterUrl as string, caption: str(o.caption, 150) }
              : undefined;
          }),
        },
      };
    case "faq":
      return {
        id,
        type: "faq",
        hidden,
        data: {
          items: arr(d.items, 50, (x) => {
            const o = obj(x);
            const q = str(o.q, 300);
            const a = str(o.a, 2000);
            return q && a ? { q, a } : undefined;
          }),
        },
      };
    case "features": {
      const kupot = arr(d.kupot, 4, (x) => ((KUPOT_LIST as readonly string[]).includes(String(x)) ? String(x) : undefined));
      const formats = arr(d.formats, 2, (x) => (x === "at_home" || x === "online" ? x : undefined)) as Array<"at_home" | "online">;
      return {
        id,
        type: "features",
        hidden,
        data: { items: arr(d.items, 40, (x) => str(x, 40)), ...(kupot.length ? { kupot } : {}), ...(formats.length ? { formats } : {}) },
      };
    }
    case "languages":
      return { id, type: b.type, hidden, data: { items: arr(d.items, 40, (x) => str(x, 40)) } };
    case "request":
      return { id, type: "request", hidden, data: { enabled: bool(d.enabled), withTime: bool(d.withTime) } };
    case "video":
      return {
        id,
        type: "video",
        hidden,
        data: {
          items: arr(d.items, 10, (x) => {
            const o = obj(x);
            const provider = o.provider === "vimeo" ? "vimeo" : o.provider === "youtube" ? "youtube" : undefined;
            const videoId = str(o.videoId, 20);
            const ok = provider === "youtube" ? /^[\w-]{11}$/.test(videoId ?? "") : /^\d{5,12}$/.test(videoId ?? "");
            return provider && videoId && ok ? { provider, videoId, title: str(o.title, 150) } : undefined;
          }),
        },
      };
    case "team":
      return {
        id,
        type: "team",
        hidden,
        data: {
          members: arr(d.members, L.team, (x) => {
            const o = obj(x);
            const name = str(o.name, 80);
            return name ? { name, role: str(o.role, 100), photoUrl: media(o.photoUrl), bio: str(o.bio, 300), bookable: bool(o.bookable) || undefined } : undefined;
          }),
        },
      };
    case "portfolio":
      return {
        id,
        type: "portfolio",
        hidden,
        data: {
          items: arr(d.items, L.portfolio, (x) => {
            const o = obj(x);
            const title = str(o.title, 150);
            return title
              ? {
                  title,
                  description: str(o.description, 1000),
                  photos: arr(o.photos, L.portfolioPhotos, media),
                  price: num(o.price),
                  priceFrom: bool(o.priceFrom) || undefined,
                  duration: str(o.duration, 50),
                }
              : undefined;
          }),
        },
      };
    case "menu":
      return {
        id,
        type: "menu",
        hidden,
        data: {
          sections: arr(d.sections, 30, (s) => {
            const o = obj(s);
            const items = arr(o.items, L.listItems, (x) => {
              const i = obj(x);
              const name = str(i.name, 150);
              return name
                ? {
                    name,
                    description: str(i.description, 300),
                    price: num(i.price),
                    photoUrl: media(i.photoUrl),
                    tags: arr(i.tags, 2, (t) => (t === "veg" || t === "spicy" ? t : undefined)),
                  }
                : undefined;
            });
            return items.length ? { title: str(o.title, 100) ?? "Меню", items } : undefined;
          }),
          files: arr(d.files, L.menuFiles, (x) => {
            const o = obj(x);
            return media(o.url) ? { title: str(o.title, 100) ?? "Меню", url: o.url as string, kind: String(o.url).endsWith(".pdf") ? "pdf" : "image" } : undefined;
          }),
        },
      };
    case "schedule":
      return {
        id,
        type: "schedule",
        hidden,
        data: {
          classes: arr(d.classes, L.listItems, (x) => {
            const o = obj(x);
            const title = str(o.title, 150);
            const day = DAYS.includes(o.day as WeekdayKey) ? (o.day as WeekdayKey) : undefined;
            const start = time(o.start);
            const end = time(o.end);
            return title && day && start && end
              ? { title, day, start, end, age: str(o.age, 40), teacher: str(o.teacher, 80), price: num(o.price), priceNote: str(o.priceNote, 40) }
              : undefined;
          }),
          note: str(d.note, 300),
        },
      };
    case "events":
      return {
        id,
        type: "events",
        hidden,
        data: {
          items: arr(d.items, 30, (x) => {
            const o = obj(x);
            const title = str(o.title, 150);
            const start = datetime(o.start);
            return title && start
              ? {
                  title,
                  start,
                  end: datetime(o.end),
                  place: str(o.place, 200),
                  description: str(o.description, 1000),
                  photoUrl: media(o.photoUrl),
                  registerUrl: link(o.registerUrl),
                  price: num(o.price),
                }
              : undefined;
          }),
        },
      };
    case "vacancies":
      return {
        id,
        type: "vacancies",
        hidden,
        data: {
          items: arr(d.items, 20, (x) => {
            const o = obj(x);
            const title = str(o.title, 150);
            return title
              ? {
                  title,
                  terms: str(o.terms, 400),
                  requirements: str(o.requirements, 600),
                  contact: str(o.contact, 150),
                  postedAt: date(o.postedAt) ?? new Date().toISOString().slice(0, 10),
                  validUntil: date(o.validUntil),
                }
              : undefined;
          }),
        },
      };
    case "news":
      return {
        id,
        type: "news",
        hidden,
        data: {
          posts: arr(d.posts, 100, (x) => {
            const o = obj(x);
            const text = str(o.text, 2000);
            return text ? { date: date(o.date) ?? new Date().toISOString().slice(0, 10), text, photoUrl: media(o.photoUrl) } : undefined;
          }),
        },
      };
    case "certificates":
      return {
        id,
        type: "certificates",
        hidden,
        data: {
          items: arr(d.items, L.certificates, (x) => {
            const o = obj(x);
            const title = str(o.title, 150);
            return title ? { title, issuer: str(o.issuer, 150), year: num(o.year, 1950, 2100), imageUrl: media(o.imageUrl) } : undefined;
          }),
        },
      };
    case "google": {
      const url = str(d.url, 1000);
      if (!url || !isGoogleMapsUrl(url)) {
        if (url) ctx.errors.push("Ссылка на Google Карты не похожа на ссылку на место.");
        return undefined;
      }
      const parsed = parseGoogleMapsUrl(url);
      const placeId = str(d.placeId, 100) ?? parsed.placeId;
      const cid = str(d.cid, 30) ?? parsed.cid;
      return { id, type: "google", hidden, data: { url, placeId: placeId?.match(/^ChIJ[\w-]+$/) ? placeId : undefined, cid: cid?.match(/^\d+$/) ? cid : undefined } };
    }
    default:
      return undefined;
  }
}

export function sanitizeListingData(
  raw: unknown,
  opts: { section: "biznes" | "specialisty"; limits?: Partial<Limits>; districts: string[]; categoryIds: number[]; badges: ListingData["header"]["badges"] },
): { data: ListingData; errors: string[] } {
  const ctx: Ctx = {
    limits: { ...FREE_LIMITS, ...(opts.limits ?? {}) },
    districts: new Set(opts.districts),
    categoryIds: new Set(opts.categoryIds),
    errors: [],
  };
  const r = obj(raw);
  const h = obj(r.header);
  const c = obj(r.contacts);
  const title = str(h.title, 120);
  if (!title) ctx.errors.push("Укажите название.");
  const categoryId = num(h.categoryId, 1);
  if (!categoryId || !ctx.categoryIds.has(categoryId)) ctx.errors.push("Выберите категорию.");
  const districtSlugs = arr(h.districtSlugs, 30, (x) => (typeof x === "string" && ctx.districts.has(x) ? x : undefined));
  if (!districtSlugs.length) ctx.errors.push("Выберите хотя бы один район.");

  const seen = new Set<string>();
  const blocks = arr(r.blocks, 40, (x) => block(x, ctx)).filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));

  const tg = str(c.telegram, 40)?.replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "");
  const ig = str(c.instagram, 60)?.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  const email = str(c.email, 120);

  const data: ListingData = {
    section: opts.section,
    header: {
      title: title ?? "",
      slogan: str(h.slogan, 160),
      profession: opts.section === "specialisty" ? str(h.profession, 100) : undefined,
      logoUrl: media(h.logoUrl),
      coverUrl: media(h.coverUrl),
      categoryId: categoryId ?? undefined,
      districtSlugs,
      badges: opts.badges, // отметки ставит только администратор
    },
    contacts: {
      phone: normalizePhone(c.phone),
      whatsapp: normalizePhone(c.whatsapp),
      telegram: tg && /^[A-Za-z0-9_]{4,32}$/.test(tg) ? tg : undefined,
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      website: link(c.website),
      instagram: ig && /^[\w.]{1,30}$/.test(ig) ? ig : undefined,
      facebook: link(c.facebook),
      tiktok: link(c.tiktok),
      youtube: link(c.youtube),
    },
    blocks,
    confirmedAt: str(r.confirmedAt, 30),
  };
  if (!data.contacts.phone && !data.contacts.whatsapp && !data.contacts.telegram && !data.contacts.email) {
    ctx.errors.push("Укажите хотя бы один способ связи: телефон, WhatsApp, Telegram или email.");
  }
  if (JSON.stringify(data).length > 300_000) ctx.errors.push("Слишком много данных в карточке.");
  return { data, errors: ctx.errors };
}
