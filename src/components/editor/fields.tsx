"use client";

import { createContext, useContext, useState } from "react";
import type { Field, Option } from "@/lib/editor/schemas";
import { DAYS, fillDefaults } from "@/lib/editor/schemas";
import type { Limits } from "@/lib/blocks/types";
import { parseVideoUrl } from "@/lib/blocks/links";
import { inputCls, labelCls, textareaCls } from "@/components/forms/ui";
import { Photo } from "@/components/ui/photo";
import { uploadMedia } from "@/components/editor/upload";
import { geocodeAddress } from "@/app/actions/cabinet";
import { PlaceMap } from "@/components/catalog/place-map";

type Obj = Record<string, unknown>;

// Поля времени и даты узкие, чтобы «с — по» помещались в одну строку на телефоне.
const timeCls = "h-12 w-[6.5rem] shrink-0 rounded-xl border border-line bg-white px-1.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export type EditorOptions = {
  districts: Option[];
  amenities: string[];
  languages: string[];
  limits: Limits;
};
export const EditorContext = createContext<EditorOptions | null>(null);
const useOpts = () => useContext(EditorContext)!;

function optionsOf(o: Option[] | string, opts: EditorOptions): Option[] {
  if (Array.isArray(o)) return o;
  if (o === "districts") return opts.districts;
  if (o === "days") return DAYS;
  if (o === "amenities") return opts.amenities.map((v) => ({ value: v, label: v }));
  if (o === "languages") return opts.languages.map((v) => ({ value: v, label: v }));
  return [];
}

const maxOf = (m: number | keyof Limits, opts: EditorOptions) => (typeof m === "number" ? m : opts.limits[m]);

// ---------- Фото ----------
export function PhotoInput({ value, onChange, label, kind = "image" }: { value?: string; onChange: (v: string | undefined) => void; label: string; kind?: "image" | "file" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isPdf = value?.endsWith(".pdf");
  return (
    <div className="grid gap-2">
      {value ? (
        <div className="flex items-center gap-3">
          {isPdf ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="grid size-20 place-items-center rounded-xl border border-line bg-surface-alt text-3xl">
              📄
            </a>
          ) : (
            <Photo src={value} alt={label} className="size-20 rounded-xl border border-line" sizes="80px" />
          )}
          <button type="button" onClick={() => onChange(undefined)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-bold text-danger hover:border-danger">
            Убрать
          </button>
        </div>
      ) : null}
      <label className={`inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 text-sm font-bold hover:border-primary ${busy ? "opacity-60" : ""}`}>
        {busy ? "Загружаем…" : value ? "📷 Заменить" : kind === "file" ? "📎 Выбрать файл" : "📷 Загрузить фото"}
        <input
          type="file"
          accept={kind === "file" ? "application/pdf,image/*" : "image/*"}
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setErr(null);
            try {
              onChange(await uploadMedia(file, kind));
            } catch (x) {
              setErr(x instanceof Error ? x.message : "Не удалось загрузить");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {err ? <p className="text-sm font-bold text-danger">⚠️ {err}</p> : null}
    </div>
  );
}

function PhotosInput({ value, onChange, max }: { value: string[]; onChange: (v: string[]) => void; max: number }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((u, i) => (
          <div key={u} className="relative">
            <Photo src={u} alt={`Фото ${i + 1}`} className="size-20 rounded-xl border border-line" sizes="80px" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-danger text-xs font-bold text-white"
              aria-label="Убрать фото"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {value.length < max ? <PhotoInput label="Фото" onChange={(u) => u && onChange([...value, u])} /> : <p className="text-xs text-muted">Максимум {max} фото.</p>}
    </div>
  );
}

// ---------- Мультивыбор чипами ----------
function MultiSelect({ options, value, onChange }: { options: Option[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${on ? "border-primary bg-primary text-white" : "border-line bg-white hover:border-primary"}`}
          >
            {on ? "✓ " : ""}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Часы работы с особыми днями ----------
type Interval = { open: string; close: string };
function HoursEditor({ obj, onChange }: { obj: Obj; onChange: (o: Obj) => void }) {
  const week = (obj.week ?? {}) as Record<string, Interval[]>;
  const exceptions = (obj.exceptions ?? []) as Array<{ date: string; closed?: boolean; intervals?: Interval[]; note?: string }>;
  const setDay = (day: string, iv: Interval[]) => onChange({ ...obj, week: { ...week, [day]: iv } });
  const setExc = (list: typeof exceptions) => onChange({ ...obj, exceptions: list });
  return (
    <div className="grid gap-3">
      {DAYS.map((d) => {
        const iv = week[d.value] ?? [];
        const open = iv.length > 0;
        return (
          <div key={d.value} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[9rem_1fr] sm:items-center sm:p-3">
            <label className="flex min-h-11 items-center gap-2 font-bold">
              <input type="checkbox" checked={open} onChange={(e) => setDay(d.value, e.target.checked ? [{ open: "09:00", close: "18:00" }] : [])} className="size-5 accent-primary" />
              {d.label}
            </label>
            {open ? (
              <div className="grid gap-2">
                {iv.map((x, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1">
                    <input type="time" value={x.open} onChange={(e) => setDay(d.value, iv.map((y, j) => (j === i ? { ...y, open: e.target.value } : y)))} className={timeCls} aria-label="Открытие" />
                    <span>—</span>
                    <input type="time" value={x.close} onChange={(e) => setDay(d.value, iv.map((y, j) => (j === i ? { ...y, close: e.target.value } : y)))} className={timeCls} aria-label="Закрытие" />
                    {iv.length > 1 ? (
                      <button type="button" onClick={() => setDay(d.value, iv.filter((_, j) => j !== i))} className="min-h-11 px-2 text-sm text-danger">
                        убрать
                      </button>
                    ) : null}
                  </div>
                ))}
                {iv.length < 3 ? (
                  <button type="button" onClick={() => setDay(d.value, [...iv, { open: "16:00", close: "20:00" }])} className="w-fit min-h-11 text-sm font-bold text-primary">
                    + перерыв / второй интервал
                  </button>
                ) : null}
              </div>
            ) : (
              <span className="text-sm text-muted">Выходной</span>
            )}
          </div>
        );
      })}
      <div className="rounded-xl bg-[#fff8e1] p-3">
        <p className="mb-2 font-bold">📅 Особые дни: праздники, короткие дни</p>
        <div className="grid gap-2">
          {exceptions.map((x, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={x.date} onChange={(e) => setExc(exceptions.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)))} className={`${timeCls} w-44`} aria-label="Дата" />
                <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={!!x.closed}
                    onChange={(e) => setExc(exceptions.map((y, j) => (j === i ? { ...y, closed: e.target.checked, intervals: e.target.checked ? undefined : [{ open: "09:00", close: "14:00" }] } : y)))}
                    className="size-5 accent-primary"
                  />
                  Закрыто
                </label>
                <button type="button" onClick={() => setExc(exceptions.filter((_, j) => j !== i))} className="ml-auto min-h-11 px-2 text-sm text-danger">
                  убрать
                </button>
              </div>
              {!x.closed ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input type="time" value={x.intervals?.[0]?.open ?? "09:00"} onChange={(e) => setExc(exceptions.map((y, j) => (j === i ? { ...y, intervals: [{ open: e.target.value, close: y.intervals?.[0]?.close ?? "14:00" }] } : y)))} className={timeCls} aria-label="Открытие" />
                  <span>—</span>
                  <input type="time" value={x.intervals?.[0]?.close ?? "14:00"} onChange={(e) => setExc(exceptions.map((y, j) => (j === i ? { ...y, intervals: [{ open: y.intervals?.[0]?.open ?? "09:00", close: e.target.value }] } : y)))} className={timeCls} aria-label="Закрытие" />
                </div>
              ) : null}
              <input value={x.note ?? ""} onChange={(e) => setExc(exceptions.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))} maxLength={120} placeholder="Причина: Песах, санитарный день…" className={inputCls} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExc([...exceptions, { date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }), closed: true }])}
            className="w-fit min-h-11 text-sm font-bold text-primary"
          >
            + добавить особый день
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Метка на карте по адресу ----------
function GeocodeField({ obj, onChange }: { obj: Obj; onChange: (o: Obj) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const lat = typeof obj.lat === "number" ? obj.lat : undefined;
  const lng = typeof obj.lng === "number" ? obj.lng : undefined;
  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={busy || !String(obj.address ?? "").trim()}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          const r = await geocodeAddress(String(obj.address ?? ""));
          setBusy(false);
          if (r.ok && r.data) {
            onChange({ ...obj, lat: r.data.lat, lng: r.data.lng });
            setMsg(`Нашли: ${r.data.label}. Проверьте метку на карте.`);
          } else setMsg(r.ok ? "Адрес не найден" : r.error);
        }}
        className="w-fit min-h-11 rounded-xl border border-line px-4 text-sm font-bold hover:border-primary disabled:opacity-50"
      >
        {busy ? "Ищем…" : "📍 Найти по адресу"}
      </button>
      {msg ? <p className="text-sm text-muted">{msg}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <label className={labelCls}>
          Широта
          <input type="number" step="0.00001" value={lat ?? ""} onChange={(e) => onChange({ ...obj, lat: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} />
        </label>
        <label className={labelCls}>
          Долгота
          <input type="number" step="0.00001" value={lng ?? ""} onChange={(e) => onChange({ ...obj, lng: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputCls} />
        </label>
      </div>
      {lat && lng ? <PlaceMap lat={lat} lng={lng} label={String(obj.address ?? "")} /> : null}
    </div>
  );
}

// ---------- Видео по ссылке ----------
function VideoField({ obj, onChange }: { obj: Obj; onChange: (o: Obj) => void }) {
  const current = obj.provider && obj.videoId ? (obj.provider === "youtube" ? `https://youtu.be/${obj.videoId}` : `https://vimeo.com/${obj.videoId}`) : "";
  const [raw, setRaw] = useState(current);
  const parsed = raw ? parseVideoUrl(raw) : null;
  return (
    <label className={labelCls}>
      Ссылка на YouTube или Vimeo
      <input
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          const p = parseVideoUrl(e.target.value);
          onChange({ ...obj, provider: p?.provider, videoId: p?.videoId });
        }}
        placeholder="https://www.youtube.com/watch?v=…"
        className={inputCls}
      />
      {raw && !parsed ? <span className="text-xs font-semibold text-danger">Не похоже на ссылку на ролик YouTube или Vimeo</span> : null}
      {parsed ? <span className="text-xs font-semibold text-success">✓ {parsed.provider === "youtube" ? "YouTube" : "Vimeo"}, ролик {parsed.videoId}</span> : null}
    </label>
  );
}

// ---------- Список элементов ----------
function ListField({ field, value, onChange }: { field: Extract<Field, { type: "list" }>; value: Obj[]; onChange: (v: Obj[]) => void }) {
  const opts = useOpts();
  const max = maxOf(field.max, opts);
  const [open, setOpen] = useState<number | null>(value.length === 1 ? 0 : null);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(j);
  };
  return (
    <div className="grid gap-2">
      {value.map((item, i) => {
        const title = (field.titleKey && String(item[field.titleKey] ?? "").slice(0, 60)) || `${field.label}: №${i + 1}`;
        const isOpen = open === i;
        return (
          <div key={i} className="min-w-0 rounded-xl border border-line bg-white">
            <div className="flex items-center gap-1 p-1 pl-3">
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="min-h-11 min-w-0 flex-1 truncate text-left text-sm font-bold" aria-expanded={isOpen}>
                {isOpen ? "▾" : "▸"} {title}
              </button>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-11 place-items-center rounded-lg hover:bg-surface-alt disabled:opacity-30" aria-label="Выше">
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="grid size-11 place-items-center rounded-lg hover:bg-surface-alt disabled:opacity-30" aria-label="Ниже">
                ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Удалить этот элемент?")) onChange(value.filter((_, j) => j !== i));
                }}
                className="grid size-11 place-items-center rounded-lg text-danger hover:bg-[#fdecea]"
                aria-label="Удалить"
              >
                🗑
              </button>
            </div>
            {isOpen ? (
              <div className="grid gap-3 border-t border-line p-3">
                <Fields fields={field.item} obj={item} onChange={(o) => onChange(value.map((x, j) => (j === i ? o : x)))} />
              </div>
            ) : null}
          </div>
        );
      })}
      {value.length < max ? (
        <button
          type="button"
          onClick={() => {
            onChange([...value, fillDefaults(field.defaults)]);
            setOpen(value.length);
          }}
          className="w-fit min-h-11 rounded-xl border-2 border-dashed border-line px-4 text-sm font-bold text-primary hover:border-primary"
        >
          + {field.addLabel}
        </button>
      ) : (
        <p className="text-xs text-muted">Достигнут лимит бесплатного тарифа: {max}.</p>
      )}
    </div>
  );
}

// ---------- Одно поле ----------
function FieldView({ field, obj, onChange }: { field: Field; obj: Obj; onChange: (o: Obj) => void }) {
  const opts = useOpts();
  const v = obj[field.k];
  const set = (x: unknown) => onChange({ ...obj, [field.k]: x === "" ? undefined : x });
  switch (field.type) {
    case "text":
    case "url":
    case "email":
    case "tel":
      return (
        <label className={labelCls}>
          {field.label}
          {field.required ? " *" : ""}
          <input
            type={field.type === "text" ? "text" : field.type}
            value={String(v ?? "")}
            maxLength={field.max}
            placeholder={field.placeholder}
            onChange={(e) => set(e.target.value)}
            className={inputCls}
          />
          {field.help ? <span className="text-xs font-normal text-muted">{field.help}</span> : null}
        </label>
      );
    case "textarea":
      return (
        <label className={labelCls}>
          {field.label}
          {field.required ? " *" : ""}
          <textarea value={String(v ?? "")} rows={field.rows ?? 3} maxLength={field.max} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} className={textareaCls} />
          {field.help ? <span className="text-xs font-normal text-muted">{field.help}</span> : null}
        </label>
      );
    case "number":
      return (
        <label className={labelCls}>
          {field.label}
          {field.suffix ? `, ${field.suffix}` : ""}
          <input
            type="number"
            inputMode="decimal"
            value={v === undefined || v === null ? "" : String(v)}
            min={field.min}
            max={field.max}
            step={field.step ?? "any"}
            onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))}
            className={`${inputCls} max-w-48`}
          />
        </label>
      );
    case "date":
    case "datetime":
    case "time":
      return (
        <label className={labelCls}>
          {field.label}
          {field.required ? " *" : ""}
          <input
            type={field.type === "datetime" ? "datetime-local" : field.type}
            value={String(v ?? "")}
            onChange={(e) => set(e.target.value)}
            className={`${inputCls} max-w-64`}
          />
          {field.help ? <span className="text-xs font-normal text-muted">{field.help}</span> : null}
        </label>
      );
    case "checkbox":
      return (
        <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
          <input type="checkbox" checked={v === true} onChange={(e) => set(e.target.checked)} className="size-5 accent-primary" />
          {field.label}
        </label>
      );
    case "select":
      return (
        <label className={labelCls}>
          {field.label}
          <select value={String(v ?? "")} onChange={(e) => set(e.target.value)} className={inputCls}>
            {!field.required ? <option value="">—</option> : null}
            {optionsOf(field.options, opts).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "multiselect":
      return (
        <div className="grid gap-1">
          <span className="text-sm font-bold">{field.label}</span>
          <MultiSelect options={optionsOf(field.options, opts)} value={(v as string[]) ?? []} onChange={set} />
        </div>
      );
    case "photo":
    case "file":
      return (
        <div className="grid gap-1">
          <span className="text-sm font-bold">{field.label}</span>
          <PhotoInput value={v as string | undefined} label={field.label} onChange={set} kind={field.type === "file" ? "file" : "image"} />
          {field.help ? <span className="text-xs text-muted">{field.help}</span> : null}
        </div>
      );
    case "photos":
      return (
        <div className="grid gap-1">
          <span className="text-sm font-bold">{field.label}</span>
          <PhotosInput value={(v as string[]) ?? []} onChange={set} max={maxOf(field.max, opts)} />
        </div>
      );
    case "video":
      return <VideoField obj={obj} onChange={onChange} />;
    case "list":
      return (
        <div className="grid gap-1">
          <span className="text-sm font-bold">{field.label}</span>
          <ListField field={field} value={(v as Obj[]) ?? []} onChange={set} />
        </div>
      );
    case "hours":
      return <HoursEditor obj={obj} onChange={onChange} />;
    case "geocode":
      return <GeocodeField obj={obj} onChange={onChange} />;
  }
}

export function Fields({ fields, obj, onChange }: { fields: Field[]; obj: Obj; onChange: (o: Obj) => void }) {
  return (
    <>
      {fields.map((f) => (
        <FieldView key={f.k} field={f} obj={obj} onChange={onChange} />
      ))}
    </>
  );
}
