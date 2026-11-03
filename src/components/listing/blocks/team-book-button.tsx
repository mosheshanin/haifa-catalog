"use client";

// «Записаться» у мастера в блоке «Команда»: выбирает мастера в форме заявки и прокручивает к ней (раздел 4 ТЗ).
export function TeamBookButton({ name }: { name: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const select = document.getElementById("request-master") as HTMLSelectElement | null;
        if (select) select.value = name;
        document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      aria-label={`Записаться: ${name}`}
      className="mt-2 inline-flex min-h-11 items-center justify-center w-full max-w-36 whitespace-nowrap rounded-xl bg-accent px-2 py-2 text-sm font-bold text-on-accent hover:bg-accent-hover"
    >
      {/* На самых узких экранах (две колонки по ~115 px) значок убираем, чтобы надпись осталась в одну строку */}
      <span className="max-[359px]:hidden" aria-hidden>✍️&nbsp;</span>
      Записаться
    </button>
  );
}
