"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FavoritesState = {
  userId: string | null | undefined; // undefined — ещё загружаем
  ids: Set<string>;
  toggle: (listingId: string) => Promise<"added" | "removed" | "login">;
};

const FavoritesContext = createContext<FavoritesState | null>(null);

// Избранное текущего пользователя: загружается один раз в браузере, сердечки на странице читают его отсюда.
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    async function load() {
      const { data } = await supabase.auth.getClaims();
      const uid = data?.claims?.sub ?? null;
      if (!active) return;
      setUserId(uid);
      if (!uid) {
        setIds(new Set());
        return;
      }
      const { data: rows } = await supabase.from("favorites").select("listing_id");
      if (active) setIds(new Set((rows ?? []).map((r) => r.listing_id as string)));
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    window.addEventListener("hbc-auth-changed", load);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("hbc-auth-changed", load);
    };
  }, []);

  const toggle = useCallback(
    async (listingId: string) => {
      if (!userId) return "login" as const;
      const supabase = createClient();
      if (ids.has(listingId)) {
        setIds((prev) => {
          const next = new Set(prev);
          next.delete(listingId);
          return next;
        });
        await supabase.from("favorites").delete().eq("user_id", userId).eq("listing_id", listingId);
        return "removed" as const;
      }
      setIds((prev) => new Set(prev).add(listingId));
      await supabase.from("favorites").insert({ user_id: userId, listing_id: listingId });
      return "added" as const;
    },
    [ids, userId],
  );

  const value = useMemo(() => ({ userId, ids, toggle }), [userId, ids, toggle]);
  return <FavoritesContext value={value}>{children}</FavoritesContext>;
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
