"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Kind = "view" | "phone" | "whatsapp" | "telegram" | "route" | "website" | "share";

function track(listingId: string, kind: Kind) {
  createClient()
    .rpc("track_listing_event", { p_listing: listingId, p_kind: kind })
    .then(({ error }) => error && console.warn("track", error.message));
}

// Статистика для владельца без cookie (раздел 6): просмотр один раз за сессию браузера и нажатия на контакты.
export function ListingTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    try {
      const key = `hbc-view-${listingId}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        track(listingId, "view");
      }
    } catch {
      track(listingId, "view");
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest("a, [data-track]") as HTMLElement | null;
      if (!a) return;
      const explicit = a.dataset.track as Kind | undefined;
      const href = a.getAttribute("href") ?? "";
      const kind: Kind | undefined =
        explicit ??
        (href.startsWith("tel:")
          ? "phone"
          : href.includes("wa.me/") && !href.includes("wa.me/?")
            ? "whatsapp"
            : /^https:\/\/t\.me\/(?!share|haifabcbot)/.test(href)
              ? "telegram"
              : href.includes("waze.com") || href.includes("google.com/maps/dir")
                ? "route"
                : undefined);
      if (kind) track(listingId, kind);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [listingId]);
  return null;
}
