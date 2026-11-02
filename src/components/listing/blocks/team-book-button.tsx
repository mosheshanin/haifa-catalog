"use client";

// «Записаться к …» в блоке «Команда»: выбирает мастера в форме заявки и прокручивает к ней (раздел 4 ТЗ).
export function TeamBookButton({ name }: { name: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const select = document.getElementById("request-master") as HTMLSelectElement | null;
        if (select) select.value = name;
        document.getElementById("request")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-3 py-2 text-sm font-bold text-white hover:bg-accent-hover"
    >
      ✍️ Записаться к {name.split(" ")[0]}
    </button>
  );
}
