"use client";

import type { Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { useLocale, useT } from "@/lib/i18n";
import {
  countryDisplayName,
  formatCavataleRating,
  formatPrice,
  typeAccent,
} from "@/lib/wines";

type Props = {
  wines: Wine[];
  selectedId: string | null;
  onSelect: (wine: Wine) => void;
  compact?: boolean;
  /** Total bottles in cellar (before filters). Distinguishes empty inventory. */
  inventoryCount?: number;
};

export function WineList({
  wines,
  selectedId,
  onSelect,
  compact = false,
  inventoryCount,
}: Props) {
  const t = useT();
  const { locale } = useLocale();

  if (wines.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-soft">
        {inventoryCount === 0
          ? t("wine.emptyCellar")
          : t("wine.noFilterMatches")}
      </p>
    );
  }

  return (
    <div
      className={[
        "min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1",
        // Mobile: cap height in document flow. Desktop: fill shared .desktop-panels row via flex-1.
        compact ? "max-h-[min(62dvh,560px)]" : "",
      ].join(" ")}
    >
      {wines.map((wine) => {
        const active = wine.id === selectedId;
        return (
          <button
            key={wine.id}
            type="button"
            onClick={() => onSelect(wine)}
            className={[
              "grid w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[10px] border px-2.5 py-3 text-left transition sm:gap-3 sm:px-3 sm:py-2.5",
              "min-h-[52px]",
              active
                ? "border-[rgba(106,26,40,0.4)] bg-[rgba(106,26,40,0.1)] shadow-[inset_3px_0_0_var(--wine)]"
                : "border-transparent hover:border-[var(--line)] hover:bg-[rgba(248,245,238,0.65)]",
            ].join(" ")}
          >
            <CountryFlag country={wine.country} size="md" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: typeAccent(wine.type) }}
                  title={wine.type}
                />
                <span className="truncate font-medium text-ink">{wine.name}</span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-ink-soft">
                {countryDisplayName(wine.country, locale)} · {wine.region} ·{" "}
                {wine.vintage ?? t("wine.naVintage")}
              </span>
            </span>
            <span className="shrink-0 text-right text-xs text-ink-soft">
              <span className="block font-medium text-ink">
                {wine.cavataleRating != null
                  ? `Cavatale ${formatCavataleRating(wine.cavataleRating)}`
                  : "—"}
              </span>
              <span className="block">{formatPrice(wine.price, wine.priceCurrency)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
