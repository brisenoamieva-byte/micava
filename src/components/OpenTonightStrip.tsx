"use client";

import { useMemo } from "react";
import { DrinkWindowBadge } from "@/components/DrinkWindowBadge";
import { useT } from "@/lib/i18n";
import {
  formatOpenTonightWhy,
  rankOpenTonight,
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
 * top pick + plain-language why, without leaving the panel first.
 */
export function OpenTonightStrip({
  wines,
  onOpenTonight,
  onSelectWine,
}: Props) {
  const t = useT();
  const top = useMemo(() => rankOpenTonight(wines, 1)[0] ?? null, [wines]);
  if (!top) return null;

  const w = top.wine;
  const why = formatOpenTonightWhy(top, t);

  return (
    <div className="mb-3 rounded-[12px] border border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--wine)]">
            {t("cava.quickOpenTonight")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium text-ink">{w.name}</p>
            <DrinkWindowBadge wine={w} />
          </div>
          {why ? (
            <p className="mt-1 text-xs leading-snug text-ink-soft">{why}</p>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">
              {t("stats.openTonightHeroLead")}
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
