import Link from "next/link";
import type { ReactNode } from "react";
import { getSiteSettings } from "@/lib/data/settings";
import { LEGAL_PAGES } from "@/lib/legal";

// Документы сайта (раздел 9 ТЗ). Пометку «Проект документа» заказчик убрал 5 ноября 2026; после проверки юристом
// обновить дату редакции.
export const LEGAL_EDITION = "2 ноября 2026";


// Кто публикует сайт и куда писать: задаётся в админке → «Справочники» → «Настройки» → «Документы сайта».
export async function getLegalContacts() {
  const { legal } = await getSiteSettings();
  return {
    owner: legal.owner || <Missing>имя будет указано</Missing>,
    email: legal.email ? (
      <a href={`mailto:${legal.email}`} className="font-semibold text-primary underline">
        {legal.email}
      </a>
    ) : (
      <Missing>адрес почты будет указан</Missing>
    ),
  };
}

function Missing({ children }: { children: ReactNode }) {
  return <span className="rounded bg-[#f9eeda] px-1 text-[#8a5a00]">[{children}]</span>;
}

export function LegalPage({ title, current, children }: { title: string; current: string; children: ReactNode }) {
  return (
    <article className="mx-auto grid max-w-3xl grid-cols-1 gap-5">
      <nav aria-label="Хлебные крошки" className="text-sm text-muted">
        <Link href="/" className="hover:text-primary">Главная</Link> › {title}
      </nav>
      <header>
        <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Редакция от {LEGAL_EDITION}</p>
      </header>
      <div className="legal grid grid-cols-1 gap-4 leading-relaxed">{children}</div>
      <nav aria-label="Другие документы" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
        {LEGAL_PAGES.filter((p) => p.href !== current).map((p) => (
          <Link key={p.href} href={p.href} className="font-semibold text-primary hover:underline">
            {p.title}
          </Link>
        ))}
      </nav>
    </article>
  );
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-4 scroll-mt-24 text-xl font-extrabold leading-snug">
      {children}
    </h2>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="grid gap-1.5 pl-5 [list-style:disc]">{children}</ul>;
}
