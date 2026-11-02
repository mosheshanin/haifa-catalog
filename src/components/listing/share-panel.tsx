"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

// «Поделиться» на карточке (разделы 4 и 5 ТЗ): QR-код, ссылка, короткая ссылка, Telegram, WhatsApp, Mini App.
// QR-код готовится на сервере (SVG) и ведёт на короткую ссылку /k/<код>.
export function SharePanel({
  title,
  url,
  shortUrl,
  miniAppUrl,
  qrSvg,
  temporaryAddress = false,
}: {
  title: string;
  url: string;
  shortUrl?: string;
  miniAppUrl: string;
  qrSvg?: string;
  temporaryAddress?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  // Системное меню «Поделиться» есть не во всех браузерах; на сервере кнопку не показываем.
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const link = shortUrl ?? url;
  const text = `${title} — в каталоге HBC`;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Скопируйте ссылку:", value);
    }
  }

  // QR в PNG для сохранения: рисуем SVG на холсте в браузере.
  async function downloadPng() {
    if (!qrSvg) return;
    const img = new Image();
    const svgUrl = URL.createObjectURL(new Blob([qrSvg], { type: "image/svg+xml" }));
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("QR не отрисовался"));
      img.src = svgUrl;
    });
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(svgUrl);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${link.split("/").pop() ?? "kartochka"}.png`;
    a.click();
  }

  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-2 text-sm font-bold hover:border-primary";

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
      {qrSvg ? (
        <figure className="mx-auto w-44 sm:mx-0">
          <div className="rounded-2xl border border-line bg-white p-2 [&>svg]:block [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <figcaption className="mt-1 text-center text-xs text-muted">Наведите камеру телефона</figcaption>
        </figure>
      ) : null}
      <div className="grid min-w-0 gap-3">
        <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-surface-alt px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-sm" title={link}>
            {link.replace(/^https?:\/\//, "")}
          </span>
          <button type="button" onClick={() => copy(link)} className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-hover">
            {copied === link ? "✓ Скопировано" : "📋 Копировать"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={btn} href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            ✈️ Telegram
          </a>
          <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${link}`)}`} target="_blank" rel="noopener noreferrer">
            💬 WhatsApp
          </a>
          <a className={btn} href={miniAppUrl} target="_blank" rel="noopener noreferrer">
            📱 Открыть в Telegram
          </a>
          {qrSvg ? (
            <button type="button" className={btn} onClick={() => void downloadPng()}>
              ⬇️ Скачать QR
            </button>
          ) : null}
          {canShare ? (
            <button type="button" className={btn} onClick={() => void navigator.share({ title, text, url: link }).catch(() => {})}>
              🔗 Ещё…
            </button>
          ) : null}
        </div>
        {shortUrl && shortUrl !== url ? (
          <button type="button" onClick={() => copy(url)} className="justify-self-start text-sm font-semibold text-primary underline-offset-2 hover:underline">
            {copied === url ? "✓ Полная ссылка скопирована" : "Скопировать полную ссылку"}
          </button>
        ) : null}
        {temporaryAddress && qrSvg ? <p className="text-xs text-muted">Пока сайт на временном адресе, QR-коды не печатаем: после подключения домена ссылка изменится.</p> : null}
      </div>
    </div>
  );
}
