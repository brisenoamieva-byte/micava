"use client";

import { useMemo, useState } from "react";
import { DrinkWindowBadge } from "@/components/DrinkWindowBadge";
import { useT } from "@/lib/i18n";
import {
  formatOpenTonightWhy,
  OPEN_OCCASIONS,
  rankOpenTonight,
  type OpenOccasion,
} from "@/lib/open-tonight";
import type { Wine } from "@/lib/types";
import { formatCavataleRating } from "@/lib/wines";

type Props = {
  wines: Wine[];
  /** Jump to full Abrir hoy (Pulso). */
  onOpenTonight: () => void;
  /** Open the recommended bottle card. */
  onSelectWine?: (wine: Wine) => void;
};

/**
 * Mobile shortcut for Abrir hoy while browsing map / list —
 * occasion chips + top pick + plain-language why.
 */
export function OpenTonightStrip({
  wines,
  onOpenTonight,
  onSelectWine,
}: Props) {
  const t = useT();
  const [occasion, setOccasion] = useState<OpenOccasion>("week");
  const top = useMemo(
    () => rankOpenTonight(wines, 1, occasion)[0] ?? null,
    [wines, occasion]
  );
  if (!top) return null;

  const w = top.wine;
  const why = formatOpenTonightWhy(top, t);

  return (
    <div className="mb-3 rounded-[12px] border border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] p-3">
      <div
        className="mb-2 flex flex-wrap gap-1"
        role="group"
        aria-label={t("stats.openOccasionLabel")}
      >
        {OPEN_OCCASIONS.map((key) => {
          const active = occasion === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              className={[
                "inline-flex min-h-[28px] items-center rounded-[7px] border px-2 text-[10px] font-medium uppercase tracking-[0.06em] transition",
                active
                  ? "border-[rgba(110,31,44,0.45)] bg-[rgba(110,31,44,0.14)] text-[var(--wine-deep)]"
                  : "border-[var(--line)] bg-[rgba(255,252,247,0.55)] text-ink-soft",
              ].join(" ")}
              onClick={() => setOccasion(key)}
            >
              {t(`stats.openOccasion.${key}`)}
            </button>
          );
        })}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--wine)]">
            {occasion === "week"
              ? t("cava.quickOpenTonight")
              : t(`stats.openOccasion.${occasion}`)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium text-ink">{w.name}</p>
            <DrinkWindowBadge wine={w} />
          </div>
          {why ? (
            <p className="mt-1 text-xs leading-snug text-ink-soft">{why}</p>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">
              {t(`stats.openOccasionLead.${occasion}`) ||
                t("stats.openTonightHeroLead")}
            </p>
          )}
        </div>
        {w.cavataleRating != null ? (
          <p className="display shrink-0 text-2xl leading-none text-ink">
            {formatCavataleRating(w.cavataleRating)}
          </p>
        ) : null}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary min-h-[40px] flex-1 px-3 text-sm"
          onClick={onOpenTonight}
        >
          {t("cava.openTonightSeeAll")}
        </button>
        {onSelectWine ? (
          <button
            type="button"
            className="btn btn-ghost min-h-[40px] border border-[var(--line)] px-3 text-sm"
            onClick={() => onSelectWine(w)}
          >
            {t("stats.openTonightCta")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
