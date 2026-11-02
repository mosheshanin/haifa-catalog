import Link from "next/link";

export function LoginRequired({ next, text = "Чтобы управлять карточками, войдите." }: { next: string; text?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6">
      <p className="font-bold">{text}</p>
      <Link href={`/vhod?next=${encodeURIComponent(next)}`} className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-primary px-5 font-bold text-white">
        Войти
      </Link>
    </div>
  );
}

export function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#f0efec] text-muted",
  pending: "bg-[#f9eeda] text-[#8a5a00]",
  published: "bg-[#e5f4e4] text-success",
  rejected: "bg-[#fbebeb] text-danger",
  archived: "bg-[#f0efec] text-muted",
  new: "bg-[#f9eeda] text-[#8a5a00]",
  accepted: "bg-[#e5f4e4] text-success",
};

export function Skeleton() {
  return <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-white/70" aria-busy="true" aria-label="Загрузка" />;
}
