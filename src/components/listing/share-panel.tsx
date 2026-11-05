"use client";

import { useState, useSyncExternalStore } from "react";
import { useInsideTelegram } from "@/components/telegram/use-inside-telegram";
import { haptic, tg } from "@/components/telegram/webapp";

const noSubscribe = () => () => {};

// «Поделиться» на карточке (разделы 4 и 5 ТЗ): QR-код, ссылка, короткая ссылка, Telegram, WhatsApp, Mini App.
// QR-код готовится на сервере (SVG) и ведёт на короткую ссылку /k/<код>.
function copyViaSelection(value: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export function SharePanel({
  title,
  url,
  shortUrl,
  miniAppUrl,
  qrSvg,
}: {
  title: string;
  url: string;
  shortUrl?: string;
  miniAppUrl: string;
  qrSvg?: string;
  /** Больше не используется: домен подключён 5 ноября 2026. Оставлено, чтобы не менять вызовы. */
  temporaryAddress?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  // Системное меню «Поделиться» — только на телефоне вне Telegram: на компьютере (Windows) оно открывает непонятное
  // окно системы, а во встроенном браузере Telegram ничего не делает (замечание заказчика 5 ноября 2026).
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
  const inTelegram = useInsideTelegram();
  const link = shortUrl ?? url;
  const text = `${title} — в каталоге HBC`;

  // Копирование: Clipboard API есть не везде (Telegram, встроенные браузеры, запрет прав), поэтому сначала старый
  // способ через выделенное поле — он работает почти везде; не вышло — показываем ссылку, чтобы скопировать вручную.
  async function copy(value: string) {
    let ok = copyViaSelection(value);
    if (!ok) {
      try {
        await navigator.clipboard.writeText(value);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (ok) {
      haptic("light");
      setManual(null);
      setCopied(value);
      setTimeout(() => setCopied(null), 2000);
    } else {
      setManual(value);
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
        {manual ? (
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Не получилось скопировать автоматически. Нажмите на ссылку и скопируйте её:</span>
            <input
              readOnly
              value={manual}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 w-full rounded-xl border border-line bg-white px-3 font-mono text-sm"
            />
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {inTelegram ? (
            // В Mini App: выбор чата прямо в Telegram, получатель откроет карточку в каталоге внутри Telegram.
            <button
              type="button"
              className={btn}
              onClick={() => {
                haptic("light");
                const share = `https://t.me/share/url?url=${encodeURIComponent(miniAppUrl)}&text=${encodeURIComponent(text)}`;
                const wa = tg();
                if (wa?.openTelegramLink) wa.openTelegramLink(share);
                else window.open(share, "_blank");
              }}
            >
              ✈️ Отправить в чат
            </button>
          ) : (
            <a className={btn} href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
              ✈️ Telegram
            </a>
          )}
          <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${link}`)}`} target="_blank" rel="noopener noreferrer">
            💬 WhatsApp
          </a>
          {inTelegram ? null : (
            <a className={btn} href={miniAppUrl} target="_blank" rel="noopener noreferrer">
              📱 Открыть в Telegram
            </a>
          )}
          {qrSvg ? (
            <button type="button" className={btn} onClick={() => void downloadPng()}>
              ⬇️ Скачать QR
            </button>
          ) : null}
          {canShare && !inTelegram ? (
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
      </div>
    </div>
  );
}
