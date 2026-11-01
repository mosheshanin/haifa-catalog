import Link from "next/link";
import { SearchForm } from "@/components/search/search-form";
import { t } from "@/i18n/ru";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-extrabold">{t.common.notFound}</h1>
      <p className="mt-2 text-muted">Возможно, карточку переименовали или удалили. Попробуйте найти её поиском.</p>
      <div className="mt-6">
        <SearchForm />
      </div>
      <Link href="/" className="mt-6 inline-block font-bold text-primary">
        На главную
      </Link>
    </div>
  );
}
