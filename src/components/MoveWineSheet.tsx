"use client";

import { useMemo, useState } from "react";
import type { CellarUnit, Wine } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { getEmptySlots } from "@/lib/wines";

type Props = {
  wine: Wine;
  cellars: CellarUnit[];
  wines: Wine[];
  onClose: () => void;
  onConfirm: (targetLocation: string, targetCellarId: string | null) => void;
};

export function MoveWineSheet({
  wine,
  cellars,
  wines,
  onClose,
  onConfirm,
}: Props) {
  const t = useT();
  const initialCellar =
    wine.cellarId && cellars.some((c) => c.id === wine.cellarId)
      ? wine.cellarId
      : cellars[0]?.id ?? null;
  const [cellarId, setCellarId] = useState<string | null>(initialCellar);
  const [slot, setSlot] = useState(
    wine.slot && wine.slot !== "abajo" ? wine.slot : ""
  );

  const unit = cellars.find((c) => c.id === cellarId) ?? null;
  const emptySlots = useMemo(() => {
    if (!unit) return [];
    const free = getEmptySlots(wines, unit.cols, unit.rows, unit.id);
    if (
      wine.slot &&
      wine.slot !== "abajo" &&
      wine.cellarId === unit.id &&
      !free.includes(wine.slot)
    ) {
      return [wine.slot, ...free];
    }
    return free;
  }, [wines, unit, wine]);

  const currentLabel =
    wine.slot === "abajo" || !wine.slot
      ? t("wine.belowOut")
      : wine.cellarId
        ? `${cellars.find((c) => c.id === wine.cellarId)?.name ?? t("wine.furniture")} · ${wine.slot}`
        : t("wine.slotLabel", { slot: wine.slot ?? "" });

  function submit() {
    if (!slot) return;
    if (slot === "abajo") {
      onConfirm("abajo", null);
      return;
    }
    if (!cellarId) return;
    onConfirm(slot, cellarId);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(20,18,16,0.45)] p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-wine-title"
      onClick={onClose}
    >
      <div
        className="panel max-h-[min(90dvh,36rem)] w-full max-w-md overflow-y-auto p-5 shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="move-wine-title" className="display text-2xl text-ink">
          {t("move.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="font-medium text-ink">{wine.name}</span>
          <span className="mt-0.5 block text-xs">
            {t("move.now", { location: currentLabel })}
          </span>
        </p>

        {cellars.length > 0 ? (
          <label className="mt-4 block text-sm text-ink-soft">
            {t("wine.furniture")}
            <select
              className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
              value={cellarId ?? ""}
              onChange={(e) => {
                const next = e.target.value || null;
                setCellarId(next);
                setSlot("");
              }}
            >
              {cellars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="mt-3 block text-sm text-ink-soft">
          {t("wine.location")}
          <select
            className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
          >
            <option value="">{t("move.pickSlot")}</option>
            <option value="abajo">{t("wine.belowOut")}</option>
            {emptySlots.map((s) => (
              <option key={s} value={s}>
                {t("wine.slotLabel", { slot: s })}
              </option>
            ))}
          </select>
        </label>

        {unit && emptySlots.length === 0 && slot !== "abajo" ? (
          <p className="mt-2 text-xs text-ink-soft">{t("move.noFreeSlots")}</p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className="btn btn-primary min-h-[44px] flex-1 disabled:opacity-50"
            disabled={!slot || (slot !== "abajo" && !cellarId)}
            onClick={submit}
          >
            {t("move.moveHere")}
          </button>
          <button
            type="button"
            className="btn btn-ghost min-h-[44px] flex-1"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
