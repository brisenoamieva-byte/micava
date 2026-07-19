"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Wine, WineDraft } from "@/lib/types";
import { countryFlagEmoji, getEmptySlots, getWineBySlot, parseLocation } from "@/lib/wines";
import { wineToDraft } from "@/lib/cellar-store";

type Props = {
  open: boolean;
  wines: Wine[];
  cellars: { id: string; name: string; cols: number; rows: string[] }[];
  activeCellarId: string | null;
  initialSlot?: string;
  editing?: Wine | null;
  onClose: () => void;
  onSubmit: (draft: WineDraft) => void;
};

const fieldClass =
  "w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.95)] px-3 py-2.5 outline-none focus:border-[rgba(122,36,48,0.45)]";

const emptyDraft = (slot = "", cellarId: string | null = null): WineDraft => ({
  name: "",
  winery: "",
  country: "México",
  region: "",
  type: "Tinto",
  grape: "",
  aging: "",
  vintage: null,
  vivino: null,
  price: null,
  cellarId,
  location: slot,
});

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function WineFormModal({
  open,
  wines,
  cellars,
  activeCellarId,
  initialSlot = "",
  editing = null,
  onClose,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState<WineDraft>(
    emptyDraft(initialSlot, activeCellarId)
  );
  const [error, setError] = useState("");

  const targetCellarId =
    draft.location === "abajo" || !draft.location
      ? null
      : draft.cellarId ?? activeCellarId;
  const targetCellar =
    cellars.find((c) => c.id === targetCellarId) ?? cellars[0] ?? null;

  const emptySlots = useMemo(() => {
    if (!targetCellar) return [];
    const free = getEmptySlots(
      wines,
      targetCellar.cols,
      targetCellar.rows,
      targetCellar.id
    );
    if (
      editing?.slot &&
      editing.slot !== "abajo" &&
      editing.cellarId === targetCellar.id &&
      !free.includes(editing.slot)
    ) {
      return [editing.slot, ...free];
    }
    return free;
  }, [wines, editing, targetCellar]);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setDraft(wineToDraft(editing));
    } else setDraft(emptyDraft(initialSlot, activeCellarId));
  }, [open, editing, initialSlot, activeCellarId]);

  if (!open) return null;

  function patch<K extends keyof WineDraft>(key: K, value: WineDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError("El nombre del vino es obligatorio.");
      return;
    }
    if (!draft.country.trim()) {
      setError("Indica el país.");
      return;
    }

    const loc = parseLocation(draft.location);
    if (loc.slot && loc.slot !== "abajo") {
      const cellarId = draft.cellarId ?? activeCellarId;
      const taken = getWineBySlot(wines, loc.slot, cellarId);
      if (taken && taken.id !== editing?.id) {
        setError(`El slot ${loc.slot} ya está ocupado por ${taken.name}.`);
        return;
      }
    }

    onSubmit({
      ...draft,
      cellarId:
        loc.slot === "abajo" || !loc.slot
          ? null
          : draft.cellarId ?? activeCellarId,
      location: loc.slot ?? "",
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,18,16,0.45)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wine-form-title"
      onClick={onClose}
    >
      <form
        className="panel max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[18px] p-4 sm:rounded-[14px] sm:p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="wine-form-title" className="display text-2xl text-ink">
              {editing ? "Editar vino" : "Agregar vino"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {editing
                ? "Actualiza datos o ubicación de la botella."
                : "Suma una botella a tu inventario y mapa."}
            </p>
          </div>
          <button type="button" className="btn btn-ghost min-h-[40px] px-3 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Nombre *
            </span>
            <input
              className={fieldClass}
              value={draft.name}
              onChange={(e) => patch("name", e.target.value)}
              placeholder="Ej. Viña Alberdi"
              required
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Bodega
            </span>
            <input
              className={fieldClass}
              value={draft.winery}
              onChange={(e) => patch("winery", e.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Tipo
            </span>
            <select
              className={fieldClass}
              value={draft.type}
              onChange={(e) => patch("type", e.target.value)}
            >
              <option>Tinto</option>
              <option>Blanco</option>
              <option>Rosado</option>
              <option>Espumoso</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              País *
            </span>
            <select
              className={fieldClass}
              value={draft.country}
              onChange={(e) => patch("country", e.target.value)}
            >
              {Object.keys(countryFlagEmoji).map((c) => (
                <option key={c} value={c}>
                  {countryFlagEmoji[c]} {c}
                </option>
              ))}
              <option value="Otro">Otro</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Región
            </span>
            <input
              className={fieldClass}
              value={draft.region}
              onChange={(e) => patch("region", e.target.value)}
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Uva
            </span>
            <input
              className={fieldClass}
              value={draft.grape}
              onChange={(e) => patch("grape", e.target.value)}
              placeholder="Tempranillo, Malbec…"
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Añejamiento
            </span>
            <input
              className={fieldClass}
              value={draft.aging}
              onChange={(e) => patch("aging", e.target.value)}
              placeholder="Reserva, 12 meses…"
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Año
            </span>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={draft.vintage ?? ""}
              onChange={(e) => patch("vintage", parseOptionalNumber(e.target.value))}
              placeholder="2021"
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Vivino
            </span>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={draft.vivino ?? ""}
              onChange={(e) => patch("vivino", parseOptionalNumber(e.target.value))}
              placeholder="4.1"
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Precio (MXN)
            </span>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={draft.price ?? ""}
              onChange={(e) => patch("price", parseOptionalNumber(e.target.value))}
              placeholder="450"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Mueble
            </span>
            <select
              className={fieldClass}
              value={draft.cellarId ?? activeCellarId ?? ""}
              onChange={(e) => {
                const nextId = e.target.value ? e.target.value : null;
                setDraft((prev) => {
                  const loc = parseLocation(prev.location);
                  if (!loc.slot || loc.slot === "abajo") {
                    return { ...prev, cellarId: nextId };
                  }
                  const unit = cellars.find((c) => c.id === nextId);
                  if (!unit) return { ...prev, cellarId: nextId };
                  const stillFree = getEmptySlots(
                    wines,
                    unit.cols,
                    unit.rows,
                    unit.id
                  ).includes(loc.slot);
                  const keepOwn =
                    editing?.cellarId === unit.id &&
                    editing.slot === loc.slot;
                  return {
                    ...prev,
                    cellarId: nextId,
                    location: stillFree || keepOwn ? prev.location : "",
                  };
                });
              }}
            >
              {cellars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.cols}×{c.rows.length})
                </option>
              ))}
            </select>
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Ubicación
            </span>
            <select
              className={fieldClass}
              value={draft.location}
              onChange={(e) => patch("location", e.target.value)}
            >
              <option value="">Sin ubicación</option>
              <option value="abajo">Abajo / fuera</option>
              {emptySlots.map((slot) => (
                <option key={slot} value={slot}>
                  Slot {slot}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-[var(--wine)]">{error}</p> : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost min-h-[44px]" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary min-h-[44px]">
            {editing ? "Guardar cambios" : "Agregar a la cava"}
          </button>
        </div>
      </form>
    </div>
  );
}
