import Form from "next/form";
import { SearchIcon } from "@/components/icons";
import { t } from "@/i18n/ru";

// Обычная HTML-форма (GET /poisk?q=…): работает и без JavaScript, адрес можно отправить другу.
export function SearchForm({ compact = false, defaultValue }: { compact?: boolean; defaultValue?: string }) {
  return (
    <Form action="/poisk" role="search" className="relative w-full">
      <label htmlFor={compact ? "q-header" : "q-main"} className="sr-only">
        Поиск
      </label>
      <SearchIcon className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted ${compact ? "size-4" : "size-5"}`} />
      <input
        id={compact ? "q-header" : "q-main"}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={t.search.placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={`w-full rounded-full border border-line bg-white pl-11 text-ink placeholder:text-muted/80 focus:border-primary focus:outline-none ${
          compact ? "h-10 pr-4 text-sm" : "h-14 pr-32 text-base shadow-sm"
        }`}
      />
      {compact ? null : (
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 h-11 -translate-y-1/2 rounded-full bg-accent px-5 font-bold text-white hover:bg-accent-hover"
        >
          {t.search.button}
        </button>
      )}
    </Form>
  );
}
