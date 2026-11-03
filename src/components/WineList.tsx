"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEvent,
} from "react";
import type { Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { DrinkWindowBadge } from "@/components/DrinkWindowBadge";
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
  /** Reset filters when the list is empty because of filters. */
  onClearFilters?: () => void;
};

/** Approx row height incl. gap — used for windowing large cellars. */
const ROW_H = 58;
const OVERSCAN = 8;
/** Below this, render everything (virtualization overhead not worth it). */
const VIRTUALIZE_FROM = 48;

export function WineList({
  wines,
  selectedId,
  onSelect,
  compact = false,
  inventoryCount,
  onClearFilters,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [windowRange, setWindowRange] = useState({ start: 0, end: 60 });

  const virtualize = wines.length >= VIRTUALIZE_FROM;

  function updateWindow() {
    const el = scrollerRef.current;
    if (!el || !virtualize) return;
    const start = Math.max(0, Math.floor(el.scrollTop / ROW_H) - OVERSCAN);
    const visible = Math.ceil(el.clientHeight / ROW_H) + OVERSCAN * 2;
    const end = Math.min(wines.length, start + Math.max(visible, 20));
    setWindowRange((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end }
    );
  }

  useLayoutEffect(() => {
    updateWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resize with list length / layout
  }, [wines.length, virtualize, compact]);

  useEffect(() => {
    if (!virtualize || !selectedId) return;
    const idx = wines.findIndex((w) => w.id === selectedId);
    if (idx < 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    const top = idx * ROW_H;
    const bottom = top + ROW_H;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight;
    }
    updateWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, virtualize]);

  if (wines.length === 0) {
    const filteredOut = (inventoryCount ?? 0) > 0;
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-ink-soft">
          {filteredOut ? t("wine.noFilterMatches") : t("wine.emptyCellar")}
        </p>
        {filteredOut && onClearFilters ? (
          <button
            type="button"
            className="btn btn-ghost min-h-[40px] border border-[var(--line)] px-3 text-sm"
            onClick={onClearFilters}
          >
            {t("wine.clearFilters")}
          </button>
        ) : null}
      </div>
    );
  }

  const start = virtualize ? windowRange.start : 0;
  const end = virtualize ? windowRange.end : wines.length;
  const slice = wines.slice(start, end);

  function onScroll(e: UIEvent<HTMLDivElement>) {
    if (!virtualize) return;
    const el = e.currentTarget;
    const nextStart = Math.max(0, Math.floor(el.scrollTop / ROW_H) - OVERSCAN);
    const visible = Math.ceil(el.clientHeight / ROW_H) + OVERSCAN * 2;
    const nextEnd = Math.min(wines.length, nextStart + Math.max(visible, 20));
    setWindowRange((prev) =>
      prev.start === nextStart && prev.end === nextEnd
        ? prev
        : { start: nextStart, end: nextEnd }
    );
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={[
        "overflow-y-auto overscroll-contain pr-1",
        // Mobile: cap height in document flow. Desktop: fill panel; scroll inside.
        compact ? "max-h-[min(62dvh,560px)]" : "min-h-0 flex-1",
      ].join(" ")}
    >
      <div
        className="relative"
        style={
          virtualize
            ? { height: wines.length * ROW_H, contain: "strict" }
            : undefined
        }
      >
        <div
          className={virtualize ? "absolute inset-x-0" : "space-y-1"}
          style={
            virtualize
              ? { top: start * ROW_H, contain: "content" }
              : undefined
          }
        >
          {slice.map((wine) => {
            const active = wine.id === selectedId;
            return (
              <button
                key={wine.id}
                type="button"
                onClick={() => onSelect(wine)}
                className={[
                  "wine-list-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[10px] border px-2.5 text-left transition sm:gap-3 sm:px-3",
                  virtualize
                    ? "mb-1 h-[54px] py-0"
                    : "min-h-[52px] py-3 sm:py-2.5",
                  active
                    ? "border-[rgba(106,26,40,0.4)] bg-[rgba(106,26,40,0.1)] shadow-[inset_3px_0_0_var(--wine)]"
                    : "border-transparent hover:border-[var(--line)] hover:bg-[rgba(248,245,238,0.65)]",
                ].join(" ")}
              >
                <CountryFlag country={wine.country} size="md" lite />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: typeAccent(wine.type) }}
                      title={wine.type}
                    />
                    <span className="truncate font-medium text-ink">
                      {wine.name}
                    </span>
                    <DrinkWindowBadge wine={wine} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">
                    {[
                      wine.grape || null,
                      countryDisplayName(wine.country, locale),
                      wine.region || null,
                      wine.vintage != null
                        ? String(wine.vintage)
                        : t("wine.naVintage"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-ink-soft">
                  <span className="block font-medium text-ink">
                    {wine.cavataleRating != null
                      ? `Cavatale ${formatCavataleRating(wine.cavataleRating)}`
                      : "—"}
                  </span>
                  <span className="block">
                    {formatPrice(wine.price, wine.priceCurrency)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
