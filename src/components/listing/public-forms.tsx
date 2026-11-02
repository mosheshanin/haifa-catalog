"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { submitClaim, submitComplaint, submitRequest, submitReview } from "@/app/actions/public";
import { Captcha } from "@/components/forms/captcha";
import { FormMessage, Modal, SubmitButton, inputCls, labelCls, textareaCls } from "@/components/forms/ui";
import { haptic } from "@/components/telegram/webapp";
import { useFavorites } from "@/components/listing/favorites-provider";
import { FlagIcon } from "@/components/icons";
import { gaEvent } from "@/components/legal/consent";

function LoginHint({ text }: { text: string }) {
  const path = usePathname();
  return (
    <p className="rounded-xl bg-surface-alt p-4 text-sm">
      {text}{" "}
      <Link href={`/vhod?next=${encodeURIComponent(path)}`} className="font-bold text-primary underline-offset-2 hover:underline">
        Войти через Google или Telegram
      </Link>
    </p>
  );
}

// ---------- Отзыв ----------
export function ReviewForm({ listingId, isDemo }: { listingId: string; isDemo: boolean }) {
  const userId = useFavorites()?.userId;
  const [state, action] = useActionState(submitReview, null);
  const [rating, setRating] = useState(0);
  const [open, setOpen] = useState(false);

  if (userId === undefined) return null;
  if (!userId) return <LoginHint text="Оставить отзыв могут вошедшие пользователи." />;
  if (state?.ok) return <FormMessage state={state} />;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-bold text-white hover:bg-primary-hover">
        ✍️ Написать отзыв
      </button>
    );
  }
  return (
    <form action={action} className="relative grid gap-3 rounded-2xl border border-line p-4">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <fieldset>
        <legend className="mb-1 text-sm font-bold">Ваша оценка</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Оценка">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} из 5`}
              onClick={() => setRating(n)}
              className={`grid size-11 place-items-center rounded-xl text-2xl ${n <= rating ? "text-highlight" : "text-line"} hover:bg-surface-alt`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <label className={labelCls}>
        Отзыв
        <textarea name="text" required rows={4} maxLength={3000} className={textareaCls} placeholder="Что понравилось, что можно улучшить" />
      </label>
      <p className="text-xs text-muted">Без ссылок и телефонов. Отзыв появится после проверки администратором.{isDemo ? " Это примерная карточка — отзыв на рейтинг не повлияет." : ""}</p>
      <Captcha />
      <FormMessage state={state} />
      <SubmitButton>Отправить отзыв</SubmitButton>
    </form>
  );
}

// ---------- Жалобы и запрос на исправление данных ----------
const REASONS = {
  listing: ["Неверные данные", "Бизнес закрыт", "Мошенничество", "Оскорбительное содержание", "Другое"],
  review: ["Ложный отзыв", "Оскорбления", "Реклама или спам", "Личные данные", "Другое"],
  data_request: ["Исправить данные", "Удалить мои данные", "Удалить карточку"],
} as const;

export function ComplaintButton({
  listingId,
  kind,
  reviewId,
  label,
  className,
}: {
  listingId: string;
  kind: keyof typeof REASONS;
  reviewId?: string;
  label: React.ReactNode;
  className?: string;
}) {
  const userId = useFavorites()?.userId;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(submitComplaint, null);
  const title = kind === "data_request" ? "Исправить или удалить данные" : kind === "review" ? "Пожаловаться на отзыв" : "Пожаловаться на карточку";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {kind !== "data_request" && !userId ? (
          <LoginHint text="Жалобу могут отправить вошедшие пользователи." />
        ) : state?.ok ? (
          <FormMessage state={state} />
        ) : (
          <form action={action} className="relative grid gap-3">
            <input type="hidden" name="listingId" value={listingId} />
            <input type="hidden" name="kind" value={kind} />
            {reviewId ? <input type="hidden" name="reviewId" value={reviewId} /> : null}
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-bold">Причина</legend>
              {REASONS[kind].map((r, i) => (
                <label key={r} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3">
                  <input type="radio" name="reason" value={r} defaultChecked={i === 0} className="size-5 accent-primary" />
                  {r}
                </label>
              ))}
            </fieldset>
            <label className={labelCls}>
              Подробнее
              <textarea name="text" rows={3} maxLength={2000} className={textareaCls} placeholder={kind === "data_request" ? "Что исправить или удалить" : "Необязательно"} />
            </label>
            {kind === "data_request" ? (
              <label className={labelCls}>
                Как с вами связаться{userId ? " (необязательно)" : ""}
                <input name="contact" maxLength={120} className={inputCls} placeholder="Телефон, Telegram или email" required={!userId} />
              </label>
            ) : null}
            <Captcha />
            <FormMessage state={state} />
            <SubmitButton tone={kind === "data_request" ? "primary" : "danger"}>Отправить</SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}

// ---------- «Это моя карточка» ----------
export function ClaimButton({ listingId, className, label }: { listingId: string; className?: string; label: string }) {
  const userId = useFavorites()?.userId;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(submitClaim, null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Это моя карточка">
        {!userId ? (
          <LoginHint text="Чтобы получить доступ к редактированию, сначала войдите." />
        ) : state?.ok ? (
          <FormMessage state={state} />
        ) : (
          <form action={action} className="relative grid gap-3">
            <input type="hidden" name="listingId" value={listingId} />
            <p className="text-sm text-muted">
              Администратор проверит, что карточка ваша: позвонит или напишет по контакту из карточки. После этого вы сможете редактировать её в кабинете.
            </p>
            <label className={labelCls}>
              Ваш телефон или Telegram
              <input name="contact" required maxLength={120} className={inputCls} placeholder="050-000-0000 или @ник" />
            </label>
            <label className={labelCls}>
              Комментарий
              <textarea name="message" rows={3} maxLength={1000} className={textareaCls} placeholder="Например: я владелец салона с 2018 года" />
            </label>
            <Captcha />
            <FormMessage state={state} />
            <SubmitButton>Отправить заявку</SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ReportListingButton({ listingId, label }: { listingId: string; label: string }) {
  return (
    <ComplaintButton
      listingId={listingId}
      kind="listing"
      label={
        <>
          <FlagIcon className="size-4" /> {label}
        </>
      }
      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-white px-4 py-2 font-semibold text-muted hover:border-danger hover:text-danger"
    />
  );
}

// ---------- Заявка и запись (раздел 5) ----------
export function RequestForm({
  listingId,
  withTime,
  services,
  masters,
  isDemo,
}: {
  listingId: string;
  withTime: boolean;
  services: string[];
  masters: string[];
  isDemo: boolean;
}) {
  const [state, action] = useActionState(submitRequest, null);
  // Сегодняшняя дата — в браузере: страница карточки собирается заранее.
  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- дата известна только в браузере
    setToday(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }));
  }, []);
  useEffect(() => {
    if (state) haptic(state.ok ? "success" : "error");
    if (state?.ok) gaEvent("generate_lead", { listing_id: listingId });
  }, [state, listingId]);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="relative grid gap-3">
      <input type="hidden" name="listingId" value={listingId} />
      <label className={labelCls}>
        Ваше имя
        <input name="name" required maxLength={80} autoComplete="name" className={inputCls} />
      </label>
      <label className={labelCls}>
        Телефон или Telegram
        <input name="contact" required maxLength={120} autoComplete="tel" className={inputCls} placeholder="050-000-0000 или @ник" />
      </label>
      {services.length ? (
        <label className={labelCls}>
          Услуга
          <select name="service" defaultValue="" className={inputCls}>
            <option value="">Не выбрана</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {masters.length ? (
        <label className={labelCls}>
          К кому
          <select id="request-master" name="master" defaultValue="" className={inputCls}>
            <option value="">Любой мастер</option>
            {masters.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {withTime ? (
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Желаемый день
            <input type="date" name="date" min={today} className={inputCls} />
          </label>
          <label className={labelCls}>
            Время
            <input type="time" name="time" step={900} className={inputCls} />
          </label>
        </div>
      ) : null}
      <label className={labelCls}>
        Комментарий
        <textarea name="comment" rows={3} maxLength={1000} className={textareaCls} />
      </label>
      {/* Согласие — галочка без предзаполнения (раздел 9 ТЗ) */}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>
          Согласен(на) передать имя и контакт владельцу карточки для ответа на заявку. Подробнее —{" "}
          <Link href="/politika" className="font-semibold text-primary underline" target="_blank">политика конфиденциальности</Link>.
        </span>
      </label>
      <Captcha />
      <FormMessage state={state} />
      <SubmitButton tone="accent">Отправить заявку</SubmitButton>
      <p className="text-xs text-muted">
        {withTime ? "Время — желаемое: владелец подтвердит его или предложит другое. " : ""}
        {isDemo ? "Это примерная карточка: заявка уйдёт в тестовый кабинет." : "Заявка придёт владельцу и сохранится в его кабинете."}
      </p>
    </form>
  );
}
