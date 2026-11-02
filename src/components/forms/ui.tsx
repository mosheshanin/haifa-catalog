"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/server/session";

export const inputCls =
  "h-12 w-full min-w-0 rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
export const textareaCls =
  "w-full min-w-0 rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
export const labelCls = "grid min-w-0 gap-1 text-sm font-bold";

export function SubmitButton({ children, className = "", tone = "primary" }: { children: ReactNode; className?: string; tone?: "primary" | "accent" | "danger" }) {
  const { pending } = useFormStatus();
  const color = tone === "accent" ? "bg-accent hover:bg-accent-hover" : tone === "danger" ? "bg-danger hover:brightness-95" : "bg-primary hover:bg-primary-hover";
  return (
    <button type="submit" disabled={pending} className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-5 font-bold text-white disabled:opacity-60 ${color} ${className}`}>
      {pending ? "Отправляем…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult | null | undefined }) {
  if (!state) return null;
  return state.ok ? (
    state.message ? (
      <p role="status" className="rounded-xl bg-[#e5f4e4] px-4 py-3 text-sm font-bold text-success">
        ✅ {state.message}
      </p>
    ) : null
  ) : (
    <p role="alert" className="rounded-xl bg-[#fdecea] px-4 py-3 text-sm font-bold text-danger">
      ⚠️ {state.error}
    </p>
  );
}

// Окно поверх страницы на <dialog>: закрывается крестиком, Esc и нажатием мимо.
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(94vw,560px)] overflow-y-auto rounded-[var(--radius-card)] bg-white p-0 text-ink backdrop:bg-black/50"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
        <h2 className="min-w-0 text-lg font-extrabold">{title}</h2>
        <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full text-xl hover:bg-surface-alt" aria-label="Закрыть">
          ✕
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
