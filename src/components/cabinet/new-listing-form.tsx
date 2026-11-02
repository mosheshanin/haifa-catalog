"use client";

import { useActionState, useState } from "react";
import { createListing } from "@/app/actions/cabinet";
import { FormMessage, SubmitButton, inputCls, labelCls } from "@/components/forms/ui";

type Cat = { id: number; section: string; parent_id: number | null; name: string; icon: string | null };

export function NewListingForm({ categories, districts, isAdmin }: { categories: Cat[]; districts: Array<{ slug: string; name: string }>; isAdmin: boolean }) {
  const [state, action] = useActionState(createListing, null);
  const [section, setSection] = useState<"biznes" | "specialisty">("biznes");
  const top = categories.filter((c) => c.section === section && !c.parent_id);
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-bold">Кого добавляем</legend>
        {[
          { v: "biznes", t: "🏢 Бизнес", d: "Салон, кафе, клиника, магазин, компания" },
          { v: "specialisty", t: "👷 Специалист", d: "Частный мастер, врач, репетитор, юрист" },
        ].map((o) => (
          <label key={o.v} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 ${section === o.v ? "border-primary bg-primary-soft" : "border-line"}`}>
            <input type="radio" name="section" value={o.v} checked={section === o.v} onChange={() => setSection(o.v as typeof section)} className="mt-1 size-5 accent-primary" />
            <span>
              <span className="block font-extrabold">{o.t}</span>
              <span className="block text-sm text-muted">{o.d}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className={labelCls}>
        {section === "biznes" ? "Название" : "Имя и первая буква фамилии"}
        <input name="title" required maxLength={120} className={inputCls} placeholder={section === "biznes" ? "Салон «Лаванда»" : "Анна К."} />
      </label>
      <label className={labelCls}>
        Категория
        <select name="categoryId" required defaultValue="" className={inputCls} key={section}>
          <option value="" disabled>
            Выберите…
          </option>
          {top.map((t) => (
            <optgroup key={t.id} label={`${t.icon ?? ""} ${t.name}`}>
              <option value={t.id}>{t.name} — общее</option>
              {categories
                .filter((c) => c.parent_id === t.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        Район
        <select name="district" required defaultValue="" className={inputCls}>
          <option value="" disabled>
            Выберите…
          </option>
          {districts.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      {isAdmin ? (
        <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
          <input type="checkbox" name="noOwner" value="1" className="size-5 accent-primary" />
          Создать без владельца (карточку заполняет администратор)
        </label>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton tone="accent">Создать и перейти к заполнению</SubmitButton>
      <p className="text-xs text-muted">Карточка появится в каталоге после проверки администратором (обычно до 48 часов).</p>
    </form>
  );
}
