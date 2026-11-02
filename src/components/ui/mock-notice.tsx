import { t } from "@/i18n/ru";

export function MockNotice({ text = t.common.mockNotice }: { text?: string }) {
  return (
    <p className="rounded-2xl border border-highlight bg-[#fff8e1] px-4 py-3 text-sm font-semibold text-ink">
      <span className="mr-2 whitespace-nowrap rounded-full bg-highlight px-2 py-0.5 text-xs font-extrabold">{t.common.example}</span>
      {text}
    </p>
  );
}
