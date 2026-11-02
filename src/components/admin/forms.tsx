"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  decideClaim,
  decideComplaint,
  decideReview,
  decideVersion,
  revertInstant,
  saveCategory,
  saveDistrict,
  saveSettings,
  saveSynonym,
  setUserAccess,
  updateListingAdmin,
  setupBot,
  setChannelMode,
  connectChannelCandidate,
  disconnectChannel,
  channelPostAction,
  postListingToChannel,
} from "@/app/actions/admin";
import { FormMessage, SubmitButton, inputCls, labelCls, textareaCls } from "@/components/forms/ui";

const btn = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold";

export function ReviewDecision({ id }: { id: string }) {
  const [state, action] = useActionState(decideReview, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="reason" maxLength={300} placeholder="Причина, если отклоняете" className={inputCls} />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="approve" className={`${btn} bg-success text-white`}>✅ Опубликовать</button>
        <button name="decision" value="reject" className={`${btn} border border-line bg-white text-danger`}>✖ Отклонить</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function ComplaintDecision({ id, isReview }: { id: string; isReview: boolean }) {
  const [state, action] = useActionState(decideComplaint, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="note" maxLength={1000} placeholder="Решение (уйдёт автору обращения)" className={inputCls} />
      {isReview ? (
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="hideReview" value="1" defaultChecked className="size-5 accent-primary" /> Снять отзыв с публикации
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="resolved" className={`${btn} bg-success text-white`}>✅ Удовлетворить</button>
        <button name="decision" value="rejected" className={`${btn} border border-line bg-white`}>✖ Отклонить</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function ClaimDecision({ id }: { id: string }) {
  const [state, action] = useActionState(decideClaim, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="comment" maxLength={500} placeholder="Комментарий (необязательно)" className={inputCls} />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="approve" className={`${btn} bg-success text-white`}>🔑 Подтвердить права</button>
        <button name="decision" value="reject" className={`${btn} border border-line bg-white text-danger`}>✖ Отклонить</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RevertForm({ id }: { id: number }) {
  const [state, action] = useActionState(revertInstant, null);
  const [open, setOpen] = useState(false);
  if (state?.ok) return <FormMessage state={state} />;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btn} border border-line bg-white text-danger hover:border-danger`}>
        ↩️ Снять
      </button>
    );
  }
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="reason" required maxLength={300} placeholder="Причина — её получит владелец" className={inputCls} />
      <FormMessage state={state} />
      <SubmitButton tone="danger" className="w-fit">Снять правку</SubmitButton>
    </form>
  );
}

// Решение по правке карточки: галочки по блокам и причины для отклонённых.
export function VersionDecision({ versionId, items, whole }: { versionId: string; items: Array<{ key: string; title: string }>; whole: boolean }) {
  const [state, action] = useActionState(decideVersion, null);
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  return (
    <form action={action} className="grid gap-3 rounded-[var(--radius-card)] border-2 border-primary/30 bg-white p-4">
      <input type="hidden" name="versionId" value={versionId} />
      <h2 className="text-lg font-extrabold">Решение</h2>
      {!whole ? (
        <div className="grid gap-2">
          {items.map((it) => (
            <div key={it.key} className="grid gap-2 rounded-xl border border-line p-3">
              <label className="flex min-h-11 items-center gap-3 font-bold">
                <input
                  type="checkbox"
                  name="approve"
                  value={it.key}
                  defaultChecked
                  onChange={(e) => {
                    const next = new Set(rejected);
                    if (e.target.checked) next.delete(it.key);
                    else next.add(it.key);
                    setRejected(next);
                  }}
                  className="size-5 accent-primary"
                />
                Одобрить: {it.title}
              </label>
              {rejected.has(it.key) ? <input name={`reason:${it.key}`} required maxLength={300} placeholder="Причина отказа по этому блоку" className={inputCls} /> : null}
            </div>
          ))}
        </div>
      ) : null}
      <label className={labelCls}>
        Комментарий владельцу{whole ? " (обязателен при отказе)" : ""}
        <textarea name="comment" rows={2} maxLength={1000} className={textareaCls} />
      </label>
      <FormMessage state={state} />
      {whole ? (
        <div className="flex flex-wrap gap-2">
          <button name="decision" value="approve" className={`${btn} min-h-12 bg-success text-white`}>✅ Опубликовать карточку</button>
          <button name="decision" value="reject" className={`${btn} min-h-12 border border-line bg-white text-danger`}>✖ Отклонить</button>
        </div>
      ) : (
        <SubmitButton className="w-fit">{rejected.size ? `Сохранить решение (отклонено: ${rejected.size})` : "✅ Одобрить всё"}</SubmitButton>
      )}
    </form>
  );
}

function Mini({ action, children, msg = true }: { action: (p: unknown, f: FormData) => Promise<unknown>; children: ReactNode; msg?: boolean }) {
  const [state, act] = useActionState(action as (p: unknown, f: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>, null);
  return (
    <form action={act} className="grid gap-2">
      {children}
      {msg ? <FormMessage state={state as never} /> : null}
    </form>
  );
}

export function ListingAdminForms({
  id,
  status,
  verified,
  ownerLabel,
  features,
  channel,
}: {
  id: string;
  status: string;
  verified: boolean;
  ownerLabel: string;
  features: string;
  channel?: { connected: boolean; auto: boolean; isDemo: boolean };
}) {
  return (
    <div className="grid gap-4">
      {channel ? (
        <div className="grid gap-3 rounded-2xl border border-line p-3">
          <p className="text-sm font-bold">📣 Канал в Telegram</p>
          <Mini action={updateListingAdmin}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="op" value="channel" />
            <input type="hidden" name="value" value={channel.auto ? "0" : "1"} />
            <p className="text-sm text-muted">
              {channel.isDemo
                ? "Примерные карточки в канал не попадают."
                : channel.auto
                  ? "Первая публикация и новые спецпредложения этой карточки уходят в канал автоматически."
                  : "Автоматическая публикация в канал для этой карточки отключена."}
            </p>
            <SubmitButton className="w-fit">{channel.auto ? "🔕 Не публиковать в канал" : "🔔 Публиковать в канал"}</SubmitButton>
          </Mini>
          {channel.connected && status === "published" ? (
            <Mini action={postListingToChannel}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton tone="accent" className="w-fit">📣 Отправить пост о карточке сейчас</SubmitButton>
            </Mini>
          ) : !channel.connected ? (
            <p className="text-sm text-muted">Канал ещё не подключён: админка → «Telegram».</p>
          ) : null}
        </div>
      ) : null}
      <Mini action={updateListingAdmin}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value={status === "archived" ? "unarchive" : "archive"} />
        <SubmitButton tone={status === "archived" ? "primary" : "danger"} className="w-fit">
          {status === "archived" ? "📤 Вернуть из архива" : "🗄 В архив (скрыть с сайта)"}
        </SubmitButton>
      </Mini>
      <Mini action={updateListingAdmin}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value="verified" />
        <input type="hidden" name="value" value={verified ? "0" : "1"} />
        <SubmitButton className="w-fit">{verified ? "Снять отметку «Проверено» в каталоге" : "✅ Отметить «Проверено» в каталоге"}</SubmitButton>
      </Mini>
      <Mini action={updateListingAdmin}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value="owner" />
        <label className={labelCls}>
          Владелец сейчас: {ownerLabel}
          <input name="owner" placeholder="Google-почта или ник Telegram; «-» — убрать владельца" className={inputCls} />
        </label>
        <SubmitButton className="w-fit">Сменить владельца</SubmitButton>
      </Mini>
      <Mini action={updateListingAdmin}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value="features" />
        <label className={labelCls}>
          Функции и лимиты (задел под платные тарифы)
          <textarea name="features" rows={4} defaultValue={features} className={`${textareaCls} font-mono text-sm`} />
          <span className="text-xs font-normal text-muted">Например: {"{\"google_reviews_text\": true, \"limits\": {\"gallery\": 60}}"}</span>
        </label>
        <SubmitButton className="w-fit">Сохранить функции</SubmitButton>
      </Mini>
    </div>
  );
}

export function UserAccessForm({ id, role, blocked, self }: { id: string; role: string; blocked: boolean; self: boolean }) {
  return (
    <Mini action={setUserAccess}>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="role" defaultValue={role} disabled={self} className={`${inputCls} w-44`}>
          <option value="user">Пользователь</option>
          <option value="admin">Администратор</option>
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="blocked" value="1" defaultChecked={blocked} disabled={self} className="size-5 accent-primary" /> Заблокирован
        </label>
        {!self ? <SubmitButton>Сохранить</SubmitButton> : <span className="text-xs text-muted">Это вы</span>}
      </div>
    </Mini>
  );
}

type Cat = { id: number; section: string; parent_id: number | null; slug: string; name: string; icon: string | null; aliases: string[]; sort: number; is_active: boolean; seo_title: string | null; seo_description: string | null; seo_text: string | null };

export function CategoryForm({ c, parents }: { c?: Cat; parents: Array<{ id: number; name: string; section: string }> }) {
  return (
    <Mini action={saveCategory}>
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-[4rem_1fr]">
        <label className={labelCls}>
          Иконка
          <input name="icon" defaultValue={c?.icon ?? ""} maxLength={8} className={inputCls} />
        </label>
        <label className={labelCls}>
          Название
          <input name="name" required defaultValue={c?.name ?? ""} maxLength={100} className={inputCls} />
        </label>
      </div>
      {!c ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={labelCls}>
            Адрес (латиницей)
            <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} placeholder="nogti" />
          </label>
          <label className={labelCls}>
            Раздел
            <select name="section" className={inputCls}>
              <option value="biznes">Бизнесы</option>
              <option value="specialisty">Специалисты</option>
            </select>
          </label>
          <label className={labelCls}>
            Родительская категория
            <select name="parent_id" className={inputCls} defaultValue="">
              <option value="">— верхний уровень —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.section === "biznes" ? "Б" : "С"}: {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <label className={labelCls}>
        Слова для поиска (через запятую)
        <input name="aliases" defaultValue={(c?.aliases ?? []).join(", ")} className={inputCls} />
      </label>
      <label className={labelCls}>
        SEO-заголовок
        <input name="seo_title" defaultValue={c?.seo_title ?? ""} maxLength={120} className={inputCls} />
      </label>
      <label className={labelCls}>
        SEO-описание
        <input name="seo_description" defaultValue={c?.seo_description ?? ""} maxLength={300} className={inputCls} />
      </label>
      <label className={labelCls}>
        Текст на странице категории
        <textarea name="seo_text" defaultValue={c?.seo_text ?? ""} rows={3} maxLength={3000} className={textareaCls} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${labelCls} w-28`}>
          Порядок
          <input name="sort" type="number" defaultValue={c?.sort ?? 100} className={inputCls} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="is_active" defaultChecked={c?.is_active ?? true} className="size-5 accent-primary" /> Показывать
        </label>
        <SubmitButton>{c ? "Сохранить" : "Добавить категорию"}</SubmitButton>
      </div>
    </Mini>
  );
}

type Dist = { id: number; slug: string; name: string; kind: string; aliases: string[]; sort: number; is_active: boolean; seo_title: string | null; seo_description: string | null };

export function DistrictForm({ d }: { d?: Dist }) {
  return (
    <Mini action={saveDistrict}>
      {d ? <input type="hidden" name="id" value={d.id} /> : null}
      <label className={labelCls}>
        Название
        <input name="name" required defaultValue={d?.name ?? ""} maxLength={100} className={inputCls} />
      </label>
      {!d ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={labelCls}>
            Адрес (латиницей)
            <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} />
          </label>
          <label className={labelCls}>
            Тип
            <select name="kind" className={inputCls}>
              <option value="haifa">Район Хайфы</option>
              <option value="suburb">Пригород</option>
            </select>
          </label>
        </div>
      ) : null}
      <label className={labelCls}>
        Другие написания (через запятую)
        <input name="aliases" defaultValue={(d?.aliases ?? []).join(", ")} className={inputCls} />
      </label>
      <label className={labelCls}>
        SEO-заголовок
        <input name="seo_title" defaultValue={d?.seo_title ?? ""} maxLength={120} className={inputCls} />
      </label>
      <label className={labelCls}>
        SEO-описание
        <input name="seo_description" defaultValue={d?.seo_description ?? ""} maxLength={300} className={inputCls} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${labelCls} w-28`}>
          Порядок
          <input name="sort" type="number" defaultValue={d?.sort ?? 100} className={inputCls} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="is_active" defaultChecked={d?.is_active ?? true} className="size-5 accent-primary" /> Показывать
        </label>
        <SubmitButton>{d ? "Сохранить" : "Добавить район"}</SubmitButton>
      </div>
    </Mini>
  );
}

export function SynonymForm({ term, expands }: { term?: string; expands?: string[] }) {
  return (
    <Mini action={saveSynonym}>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label className={labelCls}>
          Слово
          <input name="term" required defaultValue={term ?? ""} readOnly={Boolean(term)} className={inputCls} />
        </label>
        <label className={labelCls}>
          Ищем также (через запятую)
          <input name="expands" defaultValue={(expands ?? []).join(", ")} className={inputCls} />
        </label>
        <div className="flex gap-2">
          <SubmitButton>{term ? "💾" : "Добавить"}</SubmitButton>
          {term ? (
            <button name="delete" value="1" className={`${btn} border border-line bg-white text-danger`} aria-label="Удалить синоним">
              🗑
            </button>
          ) : null}
        </div>
      </div>
    </Mini>
  );
}

export function SettingsForm({ rules, amenities, languages }: { rules: { minLength: number; forbidLinks: boolean; forbidPhones: boolean }; amenities: string[]; languages: string[] }) {
  return (
    <Mini action={saveSettings}>
      <h3 className="font-extrabold">Правила отзывов</h3>
      <label className={`${labelCls} max-w-xs`}>
        Минимальная длина текста, символов
        <input name="minLength" type="number" min={0} max={500} defaultValue={rules.minLength} className={inputCls} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="forbidLinks" defaultChecked={rules.forbidLinks} className="size-5 accent-primary" /> Запрещать ссылки
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="forbidPhones" defaultChecked={rules.forbidPhones} className="size-5 accent-primary" /> Запрещать телефоны
      </label>
      <label className={labelCls}>
        Особенности (каждая с новой строки)
        <textarea name="amenities" rows={8} defaultValue={amenities.join("\n")} className={textareaCls} />
      </label>
      <label className={labelCls}>
        Языки (каждый с новой строки)
        <textarea name="languages" rows={5} defaultValue={languages.join("\n")} className={textareaCls} />
      </label>
      <SubmitButton className="w-fit">Сохранить настройки</SubmitButton>
    </Mini>
  );
}

// ---------- Telegram: бот и канал (этап 4) ----------

export function SetupBotButton({ label }: { label: string }) {
  return (
    <Mini action={setupBot}>
      <SubmitButton className="w-fit">{label}</SubmitButton>
    </Mini>
  );
}

const MODES = [
  { v: "instant", label: "Сразу после публикации" },
  { v: "digest", label: "Дайджест раз в неделю (воскресенье утром)" },
  { v: "off", label: "Выключено" },
] as const;

export function ChannelModeForm({ mode }: { mode: string }) {
  return (
    <Mini action={setChannelMode}>
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-sm font-bold">Когда публиковать</legend>
        {MODES.map((m) => (
          <label key={m.v} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="mode" value={m.v} defaultChecked={mode === m.v} className="size-5 accent-primary" /> {m.label}
          </label>
        ))}
      </fieldset>
      <SubmitButton className="w-fit">Сохранить режим</SubmitButton>
    </Mini>
  );
}

export function ConnectCandidateButton({ title }: { title: string }) {
  return (
    <Mini action={connectChannelCandidate}>
      <SubmitButton tone="accent" className="w-fit">📣 Подключить канал «{title}»</SubmitButton>
    </Mini>
  );
}

export function DisconnectChannelButton() {
  return (
    <Mini action={disconnectChannel}>
      <SubmitButton tone="danger" className="w-fit">Отключить канал</SubmitButton>
    </Mini>
  );
}

export function ChannelPostButtons({ id, status }: { id: number; status: string }) {
  const [state, act] = useActionState(channelPostAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={act} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={id} />
      {status === "queued" || status === "failed" ? (
        <button name="op" value="send" className={`${btn} bg-primary text-white`}>📣 Отправить сейчас</button>
      ) : null}
      {status === "queued" || status === "posted" ? (
        <button name="op" value="remove" className={`${btn} border border-line bg-white text-danger`}>{status === "posted" ? "🗑 Удалить из канала" : "✖ Отменить"}</button>
      ) : null}
      <FormMessage state={state} />
    </form>
  );
}
