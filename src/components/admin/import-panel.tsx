"use client";

import { useState } from "react";
import { importRow, previewImport, type PreviewRow } from "@/app/actions/import";
import { IMPORT_COLUMNS, rowsFromCsv, type ImportRow } from "@/lib/import/rows";
import { Panel } from "@/components/cabinet/common";

type Done = { line: number; ok: boolean; text: string; url?: string };

// Импорт стартовых карточек (раздел 6 ТЗ): загрузка CSV → предпросмотр с ошибками и дублями → импорт по одной строке.
export function ImportPanel() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(text: string) {
    setError(null);
    setDone([]);
    const { rows: parsed, unknownHeaders } = rowsFromCsv(text);
    if (!parsed.length) {
      setError("В файле нет строк с данными. Первая строка — заголовки из шаблона.");
      return;
    }
    setRows(parsed);
    setBusy(true);
    const r = await previewImport(parsed);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPreview(r.data ?? []);
    setSkip(new Set((r.data ?? []).filter((p) => p.errors.length || p.duplicate).map((p) => p.line)));
    if (unknownHeaders.length) setError(`Неизвестные столбцы пропущены: ${unknownHeaders.join(", ")}.`);
  }

  async function run() {
    setBusy(true);
    const list = rows.filter((r) => !skip.has(r.line));
    for (const row of list) {
      const r = await importRow(row);
      setDone((d) => [...d, r.ok ? { line: row.line, ok: true, text: r.data?.warnings.join(" ") || "Готово", url: r.data?.url } : { line: row.line, ok: false, text: r.error }]);
      // Бесплатный геокодер OpenStreetMap: не чаще одного запроса в секунду.
      await new Promise((res) => setTimeout(res, 1200));
    }
    setBusy(false);
  }

  const ready = preview ? preview.filter((p) => !skip.has(p.line)).length : 0;

  return (
    <div className="grid gap-5">
      <Panel title="📥 Импорт карточек из таблицы">
        <ol className="grid list-decimal gap-2 pl-5 text-sm">
          <li>
            Скачайте <a href="/import-shablon.csv" download className="font-bold text-primary">шаблон таблицы (CSV)</a> и откройте его в Google Таблицах или Excel. Первая строка — заголовки, вторая — пример: замените её своими данными.
          </li>
          <li>Сохраните как CSV (в Google Таблицах: «Файл → Скачать → CSV») и загрузите ниже.</li>
          <li>Проверьте предпросмотр: строки с ошибками и возможные дубли по умолчанию пропускаются.</li>
          <li>Карточки создаются без владельца и сразу публикуются; фото скачиваются в наше хранилище, метка на карте ставится по адресу. Проверьте метки в редакторе.</li>
        </ol>
        <details className="mt-3 text-sm">
          <summary className="min-h-11 cursor-pointer font-bold">Столбцы шаблона</summary>
          <ul className="mt-2 grid gap-1">
            {IMPORT_COLUMNS.map((c) => (
              <li key={c.k}>
                <b>{c.h}</b>
                {"required" in c && c.required ? " (обязательно)" : ""}
                {c.hint ? ` — ${c.hint}` : ""}
              </li>
            ))}
          </ul>
        </details>
        <label className="mt-4 inline-flex min-h-12 cursor-pointer items-center rounded-2xl bg-primary px-5 font-bold text-white hover:bg-primary-hover">
          📄 Выбрать CSV-файл
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) await load(await f.text());
            }}
          />
        </label>
        {busy && !preview ? <p className="mt-3 text-sm text-muted">Проверяем…</p> : null}
        {error ? <p className="mt-3 rounded-xl bg-[#fdecea] p-3 text-sm font-bold text-danger">⚠️ {error}</p> : null}
      </Panel>

      {preview ? (
        <Panel title={`Предпросмотр: ${preview.length} строк, к импорту ${ready}`}>
          <ul className="grid gap-2">
            {preview.map((p) => {
              const res = done.find((d) => d.line === p.line);
              return (
                <li key={p.line} className={`grid gap-1 rounded-xl border p-3 text-sm ${p.errors.length ? "border-danger/40 bg-[#fdecea]/40" : p.duplicate ? "border-[#e0b04c] bg-[#fff8e1]" : "border-line"}`}>
                  <label className="flex min-h-11 items-center gap-3 font-bold">
                    <input
                      type="checkbox"
                      checked={!skip.has(p.line)}
                      disabled={p.errors.length > 0 || busy}
                      onChange={(e) => {
                        const n = new Set(skip);
                        if (e.target.checked) n.delete(p.line);
                        else n.add(p.line);
                        setSkip(n);
                      }}
                      className="size-5 accent-primary"
                    />
                    Строка {p.line}: {p.title || "без названия"}
                  </label>
                  {p.errors.map((e) => (
                    <p key={e} className="text-danger">⛔ {e}</p>
                  ))}
                  {p.duplicate ? <p className="text-[#8a5a00]">⚠️ Возможный дубль: {p.duplicate}</p> : null}
                  {p.warnings.map((w) => (
                    <p key={w} className="text-muted">ℹ️ {w}</p>
                  ))}
                  {res ? (
                    <p className={res.ok ? "font-bold text-success" : "font-bold text-danger"}>
                      {res.ok ? "✅ " : "⛔ "}
                      {res.text}{" "}
                      {res.url ? (
                        <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          открыть
                        </a>
                      ) : null}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={run} disabled={busy || !ready || done.length > 0} className="mt-4 min-h-12 rounded-2xl bg-accent px-5 font-bold text-on-accent disabled:opacity-60">
            {busy ? `Импортируем… ${done.length} из ${ready}` : done.length ? `Готово: ${done.filter((d) => d.ok).length} из ${ready}` : `📥 Импортировать ${ready}`}
          </button>
        </Panel>
      ) : null}
    </div>
  );
}
