import Link from "next/link";

const TABS = [
  { href: "/kabinet", label: "🗂️ Карточки" },
  { href: "/kabinet/zayavki", label: "✍️ Заявки" },
  { href: "/kabinet/otzyvy", label: "💬 Отзывы" },
  { href: "/kabinet/statistika", label: "📊 Статистика" },
];

// Кабинет владельца (раздел 6 ТЗ): общие вкладки над всеми страницами кабинета.
export default function CabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <nav aria-label="Кабинет" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="min-h-11 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold hover:border-primary hover:bg-primary-soft">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
