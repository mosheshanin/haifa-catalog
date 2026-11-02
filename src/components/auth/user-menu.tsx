"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserIcon } from "@/components/icons";
import { t } from "@/i18n/ru";

type MiniProfile = { name: string; avatar: string | null; isAdmin: boolean };

// Состояние входа в шапке читается в браузере, чтобы публичные страницы оставались статичными.
export function UserMenu() {
  const [profile, setProfile] = useState<MiniProfile | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data } = await supabase.auth.getClaims();
      const userId = data?.claims?.sub;
      if (!userId) {
        if (active) setProfile(null);
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, role, google_email, telegram_username")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      setProfile(
        p
          ? {
              name: p.display_name || p.google_email || p.telegram_username || t.nav.profile,
              avatar: p.avatar_url,
              isAdmin: p.role === "admin",
            }
          : null,
      );
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    const onChanged = () => load();
    window.addEventListener("hbc-auth-changed", onChanged);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("hbc-auth-changed", onChanged);
    };
  }, []);

  if (profile === undefined) {
    return <span className="inline-block h-10 w-24 rounded-full bg-primary-soft/60" aria-hidden />;
  }

  if (!profile) {
    return (
      <Link
        href="/vhod"
        className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover"
      >
        <UserIcon className="size-4" />
        {t.nav.login}
      </Link>
    );
  }

  return (
    // Пункты в одну строку; «Админка» и «Мои карточки» — с широкого экрана (на телефоне они в профиле), имя — с 1280 px.
    <div className="flex shrink-0 items-center gap-1">
      {profile.isAdmin ? (
        <Link href="/admin" className="hidden whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-soft lg:inline-block">
          {t.nav.admin}
        </Link>
      ) : null}
      <Link href="/kabinet" className="hidden whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-soft lg:inline-block">
        {t.nav.cabinet}
      </Link>
      <Link
        href="/profil"
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-white p-1 text-sm font-semibold hover:border-primary xl:pr-3"
        title={`${t.nav.profile}: ${profile.name}`}
        aria-label={`${t.nav.profile}: ${profile.name}`}
      >
        {profile.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar} alt="" className="size-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-primary">
            <UserIcon className="size-4" />
          </span>
        )}
        <span className="hidden max-w-32 truncate xl:inline">{profile.name}</span>
      </Link>
    </div>
  );
}
