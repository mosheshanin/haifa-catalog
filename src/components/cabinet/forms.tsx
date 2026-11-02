"use client";

import { useActionState } from "react";
import { replyToReview, updateNotifyPrefs, updateRequest } from "@/app/actions/cabinet";
import { FormMessage, SubmitButton, inputCls, textareaCls } from "@/components/forms/ui";

export function NotifyPrefsForm({ prefs }: { prefs: Record<string, boolean> }) {
  const [state, action] = useActionState(updateNotifyPrefs, null);
  const items = [
    { k: "requests", label: "✍️ Новые заявки" },
    { k: "reviews", label: "💬 Новые отзывы" },
    { k: "moderation", label: "🛡 Результат проверки карточки" },
    { k: "updates", label: "📬 Ответы на мои отзывы, решения по моим заявкам, акции в избранном" },
  ];
  return (
    <form action={action} className="grid gap-2">
      {items.map((i) => (
        <label key={i.k} className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3">
          <input type="checkbox" name={i.k} defaultChecked={prefs[i.k] !== false} className="size-5 accent-primary" />
          {i.label}
        </label>
      ))}
      <FormMessage state={state} />
      <SubmitButton className="w-fit">Сохранить</SubmitButton>
    </form>
  );
}

export function RequestStatusForm({ id, status, note }: { id: string; status: string; note: string | null }) {
  const [state, action] = useActionState(updateRequest, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <textarea name="note" defaultValue={note ?? ""} rows={2} maxLength={500} placeholder="Заметка для себя: договорились на четверг в 16:00" className={textareaCls} />
      <div className="flex flex-wrap gap-2">
        <button name="status" value="accepted" className={`min-h-11 rounded-xl px-4 text-sm font-bold ${status === "accepted" ? "bg-success text-white" : "border border-line bg-white hover:border-success"}`}>
          ✅ Принять
        </button>
        <button name="status" value="rejected" className={`min-h-11 rounded-xl px-4 text-sm font-bold ${status === "rejected" ? "bg-danger text-white" : "border border-line bg-white hover:border-danger"}`}>
          ✖ Отклонить
        </button>
        <button name="status" value={status} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold hover:border-primary">
          💾 Сохранить заметку
        </button>
      </div>
      <FormMessage state={state?.ok ? null : state} />
    </form>
  );
}

export function ReplyForm({ reviewId, reply }: { reviewId: string; reply: string | null }) {
  const [state, action] = useActionState(replyToReview, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <textarea name="reply" defaultValue={reply ?? ""} rows={3} maxLength={2000} placeholder="Ваш ответ появится под отзывом сразу" className={textareaCls} />
      <FormMessage state={state} />
      <SubmitButton className="w-fit">{reply ? "Обновить ответ" : "Ответить"}</SubmitButton>
    </form>
  );
}

export { inputCls };
