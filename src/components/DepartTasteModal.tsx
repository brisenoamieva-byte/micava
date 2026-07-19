"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { DepartAction, DepartExtras, Wine } from "@/lib/types";

type Props = {
  open: boolean;
  wine: Wine | null;
  action: DepartAction;
  onClose: () => void;
  onConfirm: (extras: DepartExtras) => void;
};

const titles: Record<DepartAction, string> = {
  opened: "¿Qué tal estuvo?",
  gifted: "Regalo",
  removed: "Quitar de la cava",
};

const submits: Record<DepartAction, string> = {
  opened: "Guardar y sacar",
  gifted: "Confirmar regalo",
  removed: "Quitar",
};

export function DepartTasteModal({
  open,
  wine,
  action,
  onClose,
  onConfirm,
}: Props) {
  const [myRating, setMyRating] = useState<number | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setMyRating(null);
    setNote("");
  }, [open, wine?.id, action]);

  if (!open || !wine) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm({
      myRating,
      note: note.trim() || null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,18,16,0.45)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="depart-taste-title"
      onClick={onClose}
    >
      <form
        className="panel w-full max-w-md p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          {wine.name}
        </p>
        <h2 id="depart-taste-title" className="display mt-1 text-3xl text-ink">
          {titles[action]}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {action === "opened"
            ? "Saldrá del inventario. Tu nota te ayuda a recordar qué repetir."
            : "Saldrá del inventario. Puedes dejar una nota breve."}
        </p>

        <fieldset className="mt-5">
          <legend className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {action === "opened" ? "Tu calificación" : "Calificación (opcional)"}
          </legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = myRating === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMyRating(n)}
                  className={[
                    "min-h-[44px] min-w-[44px] rounded-[10px] border text-sm font-medium transition",
                    active
                      ? "border-[var(--wine)] bg-[rgba(110,31,44,0.12)] text-ink"
                      : "border-[var(--line)] bg-[rgba(255,252,247,0.7)] text-ink-soft hover:border-[rgba(110,31,44,0.3)]",
                  ].join(" ")}
                  aria-pressed={active}
                  aria-label={`${n} de 5`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            1 poco · 3 bien · 5 lo repetiría
          </p>
        </fieldset>

        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Nota breve
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 180))}
            rows={2}
            placeholder="Ej. fresco, ideal con pasta; compraría otra"
            className="w-full rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.95)] px-3 py-2.5 text-sm outline-none focus:border-[rgba(122,36,48,0.45)]"
          />
          <span className="mt-1 block text-right text-[10px] text-ink-soft">
            {note.length}/180
          </span>
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost min-h-[44px]" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary min-h-[44px]">
            {submits[action]}
          </button>
        </div>
      </form>
    </div>
  );
}
