import Form from "next/form";
import Link from "next/link";
import { KUPOT, LANGUAGES, SORTS, type CatalogFilters } from "@/lib/catalog/params";
import type { Category, District } from "@/lib/data/dictionaries";
import type { FilterAvailability } from "@/lib/data/filters";
import { AutoSubmit } from "@/components/catalog/auto-submit";

// Фильтры как обычная HTML-форма (GET): работают без JavaScript, результат можно отправить ссылкой.
// На телефоне свёрнуты в раскрывающуюся панель (раздел 10 ТЗ). С JavaScript применяются сразу при изменении (AutoSubmit).
// Набор и названия фильтров зависят от категории, пустые фильтры скрыты (avail, решение 2 ноября 2026).
export function FiltersForm({
  action,
  filters,
  districts,
  categories,
  showDistrict = true,
  resetHref,
  avail,
}: {
  action: string;
  filters: CatalogFilters;
  districts: District[];
  categories?: Category[];
  showDistrict?: boolean;
  resetHref: string;
  avail: FilterAvailability;
}) {
  const active = [
    filters.district,
    filters.language,
    filters.openNow,
    filters.atHome,
    filters.onSite,
    filters.online,
    filters.hasOffer,
    filters.kupa,
    filters.category && categories,
  ].filter(Boolean).length + filters.amenities.length;

  const select = "h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold focus:border-primary focus:outline-none";
  const check = "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary";

  return (
    <details className="group rounded-[var(--radius-card)] border border-line bg-white shadow-sm md:open:pb-1" open={active > 0}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-extrabold marker:hidden">
        <span>⚙️ Фильтры{active ? <span className="ml-2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs text-on-accent">{active}</span> : null}</span>
        <span className="text-sm font-semibold text-muted group-open:hidden">показать</span>
        <span className="hidden text-sm font-semibold text-muted group-open:inline">скрыть</span>
      </summary>
      <Form action={action} scroll={false} replace className="grid gap-3 border-t border-line p-4">
        <AutoSubmit />
        {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
        {filters.view === "map" ? <input type="hidden" name="view" value="map" /> : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories ? (
            <label className="grid gap-1 text-sm font-bold">
              Категория
              <select name="category" defaultValue={filters.category ?? ""} className={select}>
                <option value="">Все категории</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showDistrict ? (
            <label className="grid gap-1 text-sm font-bold">
              📍 Район
              <select name="district" defaultValue={filters.district ?? ""} className={select}>
                <option value="">Вся Хайфа и пригороды</option>
                <optgroup label="Хайфа">
                  {districts.filter((d) => d.kind === "haifa").map((d) => (
                    <option key={d.id} value={d.slug}>{d.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Пригороды">
                  {districts.filter((d) => d.kind === "suburb").map((d) => (
                    <option key={d.id} value={d.slug}>{d.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-bold">
            🗣️ Язык общения
            <select name="lang" defaultValue={filters.language ?? ""} className={select}>
              <option value="">Любой</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
          {avail.kupa ? (
            <label className="grid gap-1 text-sm font-bold">
              🏥 Больничная касса
              <select name="kupa" defaultValue={filters.kupa ?? ""} className={select}>
                <option value="">Не важно</option>
                {KUPOT.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-bold">
            ↕️ Сортировка
            <select name="sort" defaultValue={filters.sort} className={select}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {avail.open ? (
            <label className={check}>
              <input type="checkbox" name="open" value="1" defaultChecked={filters.openNow} className="size-4 accent-[var(--color-primary)]" /> 🕒 Открыто сейчас
            </label>
          ) : null}
          {avail.home ? (
            <label className={check}>
              <input type="checkbox" name="home" value="1" defaultChecked={filters.atHome} className="size-4 accent-[var(--color-primary)]" /> {avail.home}
            </label>
          ) : null}
          {avail.site ? (
            <label className={check}>
              <input type="checkbox" name="site" value="1" defaultChecked={filters.onSite} className="size-4 accent-[var(--color-primary)]" /> {avail.site}
            </label>
          ) : null}
          {avail.online ? (
            <label className={check}>
              <input type="checkbox" name="online" value="1" defaultChecked={filters.online} className="size-4 accent-[var(--color-primary)]" /> {avail.online}
            </label>
          ) : null}
          {avail.offer ? (
            <label className={check}>
              <input type="checkbox" name="offer" value="1" defaultChecked={filters.hasOffer} className="size-4 accent-[var(--color-primary)]" /> 🎁 Есть акция
            </label>
          ) : null}
        </div>
        {avail.amenities.length ? (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-bold">✨ Особенности</legend>
            <div className="flex flex-wrap gap-2">
              {avail.amenities.map((a) => (
                <label key={a} className={check}>
                  <input type="checkbox" name="f" value={a} defaultChecked={filters.amenities.includes(a)} className="size-4 accent-[var(--color-primary)]" /> {a}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="h-11 rounded-2xl bg-primary px-6 font-bold text-white hover:bg-primary-hover">
            Показать
          </button>
          {active ? (
            <Link href={resetHref} className="text-sm font-bold text-muted hover:text-danger">
              Сбросить фильтры
            </Link>
          ) : null}
        </div>
      </Form>
    </details>
  );
}
