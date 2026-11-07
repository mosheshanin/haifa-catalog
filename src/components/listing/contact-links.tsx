/* eslint-disable @next/next/no-img-element -- маленькие векторные логотипы соцсетей */
import type { ListingData } from "@/lib/blocks/types";
import { GlobeIcon } from "@/components/icons";
import { safeHref } from "@/lib/blocks/links";
import { telegramHref } from "@/lib/format";

// Дополнительные контакты карточки: сайт, Email, Instagram, Facebook, TikTok, YouTube (и Telegram на телефоне).
// До 7 ноября 2026 эти поля заполнялись в мастере и редакторе, но на странице карточки не выводились нигде.
// Телефон и WhatsApp сюда не входят — для них большие кнопки в шапке, нижней панели и панели «Связаться».

type Contacts = ListingData["contacts"];

type Item = { key: string; href: string; label: string; icon: React.ReactNode; aria: string; external: boolean; track?: "website" | "telegram"; className?: string };

const logo = (name: string) => <img src={`/brand/logos/${name}.svg`} alt="" width={18} height={18} className="size-[18px] shrink-0" />;

// «https://www.example.co.il/ru/» → «example.co.il»
function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Сайт";
  }
}

export function contactLinkItems(c: Contacts, opts: { telegram?: boolean } = {}): Item[] {
  const items: Item[] = [];
  const website = safeHref(c.website);
  if (website) {
    const host = siteLabel(website);
    items.push({ key: "website", href: website, label: host, aria: `Сайт: ${host}`, icon: <GlobeIcon className="size-[18px] shrink-0 text-primary" />, external: true, track: "website" });
  }
  if (opts.telegram && c.telegram) {
    // На телефоне большой кнопки Telegram нет (нижняя панель — телефон и WhatsApp), поэтому он здесь.
    items.push({ key: "telegram", href: telegramHref(c.telegram), label: `@${c.telegram}`, aria: `Telegram: @${c.telegram}`, icon: logo("telegram"), external: true, className: "md:hidden" });
  }
  if (c.email) {
    items.push({ key: "email", href: `mailto:${c.email}`, label: c.email, aria: `Email: ${c.email}`, icon: <span aria-hidden className="shrink-0">✉️</span>, external: false });
  }
  if (c.instagram) {
    items.push({ key: "instagram", href: `https://instagram.com/${c.instagram}`, label: `@${c.instagram}`, aria: `Instagram: @${c.instagram}`, icon: logo("instagram"), external: true });
  }
  const facebook = safeHref(c.facebook);
  if (facebook) items.push({ key: "facebook", href: facebook, label: "Facebook", aria: "Страница в Facebook", icon: logo("facebook"), external: true });
  const tiktok = safeHref(c.tiktok);
  if (tiktok) items.push({ key: "tiktok", href: tiktok, label: "TikTok", aria: "Страница в TikTok", icon: <span aria-hidden className="shrink-0">🎵</span>, external: true });
  const youtube = safeHref(c.youtube);
  if (youtube) items.push({ key: "youtube", href: youtube, label: "YouTube", aria: "Канал на YouTube", icon: <span aria-hidden className="shrink-0">▶️</span>, external: true });
  return items;
}

// layout="chips" — строка «таблеток» в шапке; layout="list" — столбик в панели «Связаться» на компьютере.
export function ContactLinks({ contacts, telegram = false, layout = "chips", className = "" }: { contacts: Contacts; telegram?: boolean; layout?: "chips" | "list"; className?: string }) {
  const items = contactLinkItems(contacts, { telegram });
  if (!items.length) return null;
  const chip =
    layout === "chips"
      ? "inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold hover:border-primary"
      : "flex min-h-11 items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm font-semibold hover:text-primary";
  return (
    <ul className={`${layout === "chips" ? "flex flex-wrap gap-2" : "grid gap-0.5"} ${className}`} aria-label="Сайт и соцсети">
      {items.map((it) => (
        <li key={it.key} className={`min-w-0 ${it.className ?? ""}`}>
          <a
            href={it.href}
            aria-label={it.aria}
            data-track={it.track}
            className={chip}
            {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {it.icon}
            <span className="min-w-0 truncate">{it.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
