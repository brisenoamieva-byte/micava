"use client";

import { useMemo, useState } from "react";
import type { CellarUnit, Wine } from "@/lib/types";
import { DEFAULT_CELLAR_COLS, DEFAULT_CELLAR_ROWS } from "@/lib/supabase/map";

type Props = {
  cellars: CellarUnit[];
  wines: Wine[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (input: {
    name: string;
    cols: number;
    rows: string[];
  }) => Promise<unknown>;
  onUpdate: (
    id: string,
    patch: Partial<Pick<CellarUnit, "name" | "cols" | "rows">>
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function rowsFromCount(n: number): string[] {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const count = Math.min(26, Math.max(1, n));
  return letters.slice(0, count).split("");
}

export function CellarUnitsBar({
  cellars,
  wines,
  activeId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cols, setCols] = useState(DEFAULT_CELLAR_COLS);
  const [rowCount, setRowCount] = useState(DEFAULT_CELLAR_ROWS.length);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of wines) {
      if (!w.cellarId) continue;
      map.set(w.cellarId, (map.get(w.cellarId) ?? 0) + 1);
    }
    return map;
  }, [wines]);

  const fuera = wines.filter(
    (w) => w.slot === "abajo" || !w.slot
  ).length;

  function openCreate() {
    setCreating(true);
    setEditingId(null);
    setName(`Mueble ${cellars.length + 1}`);
    setCols(DEFAULT_CELLAR_COLS);
    setRowCount(DEFAULT_CELLAR_ROWS.length);
  }

  function openEdit(unit: CellarUnit) {
    setEditingId(unit.id);
    setCreating(false);
    setName(unit.name);
    setCols(unit.cols);
    setRowCount(unit.rows.length);
  }

  async function save() {
    setBusy(true);
    try {
      const rows = rowsFromCount(rowCount);
      if (creating) {
        await onAdd({ name, cols, rows });
        setCreating(false);
      } else if (editingId) {
        await onUpdate(editingId, { name, cols, rows });
        setEditingId(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Tus muebles
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Elige un mueble para ver su rejilla · {fuera} fuera / sin slot
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost min-h-[36px] px-3 text-sm"
          onClick={openCreate}
        >
          + Nuevo mueble
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {cellars.map((c) => {
          const active = c.id === activeId;
          const n = counts.get(c.id) ?? 0;
          return (
            <div key={c.id} className="inline-flex items-stretch">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={[
                  "min-h-[40px] rounded-l-[10px] border px-3 py-2 text-left text-sm transition",
                  active
                    ? "border-[rgba(110,31,44,0.35)] bg-[rgba(110,31,44,0.1)] font-medium text-ink"
                    : "border-[var(--line)] bg-[rgba(255,252,247,0.55)] text-ink hover:border-[rgba(110,31,44,0.25)]",
                ].join(" ")}
              >
                {c.name}
                <span className="ml-2 text-xs text-ink-soft">
                  {c.cols}×{c.rows.length} · {n}
                </span>
              </button>
              <button
                type="button"
                title="Editar mueble"
                className={[
                  "min-h-[40px] rounded-r-[10px] border border-l-0 px-2 text-xs text-ink-soft transition hover:text-ink",
                  active
                    ? "border-[rgba(110,31,44,0.35)] bg-[rgba(110,31,44,0.06)]"
                    : "border-[var(--line)] bg-[rgba(255,252,247,0.55)]",
                ].join(" ")}
                onClick={() => openEdit(c)}
              >
                Editar
              </button>
            </div>
          );
        })}
      </div>

      {(creating || editingId) && (
        <div className="mt-4 space-y-3 rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] p-3">
          <p className="text-sm font-medium text-ink">
            {creating ? "Nuevo mueble" : "Editar mueble"}
          </p>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Nombre
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[40px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2"
              placeholder="Principal, Nevera…"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Columnas (1–24)
              </span>
              <input
                type="number"
                min={1}
                max={24}
                value={cols}
                onChange={(e) => setCols(Number(e.target.value) || 1)}
                className="w-full min-h-[40px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Filas (A…)
              </span>
              <input
                type="number"
                min={1}
                max={26}
                value={rowCount}
                onChange={(e) => setRowCount(Number(e.target.value) || 1)}
                className="w-full min-h-[40px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2"
              />
            </label>
          </div>
          <p className="text-xs text-ink-soft">
            Rejilla: {cols} × {rowsFromCount(rowCount).join("")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-[40px] px-3 text-sm"
              disabled={busy}
              onClick={() => void save()}
            >
              Guardar
            </button>
            <button
              type="button"
              className="btn btn-ghost min-h-[40px] px-3 text-sm"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
              }}
            >
              Cancelar
            </button>
            {editingId && cellars.length > 1 ? (
              <button
                type="button"
                className="btn min-h-[40px] px-3 text-sm text-[var(--wine-deep)]"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "¿Eliminar este mueble?\nSus botellas quedarán sin ubicación hasta que las acomodes en otro."
                    )
                  ) {
                    void onDelete(editingId).then(() => setEditingId(null));
                  }
                }}
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
