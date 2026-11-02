"use client";

import { useActionState, useEffect } from "react";
import { deleteAccount } from "@/app/actions/account";
import { FormMessage, SubmitButton, inputCls, labelCls } from "@/components/forms/ui";

// Кнопка «Удалить аккаунт» в профиле (раздел 9 ТЗ): подтверждение словом «удалить», после удаления — на главную.
export function DeleteAccount({ hasListings }: { hasListings: boolean }) {
  const [state, action] = useActionState(deleteAccount, null);
  useEffect(() => {
    // Полная перезагрузка: шапка и избранное должны забыть удалённый аккаунт.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (state?.ok) window.location.assign("/");
  }, [state]);
  return (
    <details className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <summary className="min-h-11 cursor-pointer font-bold text-danger">🗑 Удалить аккаунт</summary>
      <form action={action} className="mt-3 grid gap-3 text-sm">
        <ul className="grid gap-1 pl-5 [list-style:disc]">
          <li>Профиль, избранное и привязки Google и Telegram удалятся.</li>
          <li>Ваши отзывы останутся без имени автора.</li>
          <li>В ваших заявках у владельцев карточек сотрутся имя и контакт.</li>
          {hasListings ? <li>Ваши карточки останутся в каталоге без владельца — ими займётся администратор. Удалить карточку можно кнопкой «Исправить или удалить данные» на ней.</li> : null}
        </ul>
        <p className="font-semibold">Удаление нельзя отменить.</p>
        <label className={labelCls}>
          Напишите «удалить»
          <input name="confirm" required autoComplete="off" className={inputCls} />
        </label>
        <FormMessage state={state} />
        <SubmitButton tone="danger" className="w-fit">Удалить аккаунт навсегда</SubmitButton>
      </form>
    </details>
  );
}
