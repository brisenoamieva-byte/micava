"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DRINK_STATUS_CLASS,
  DRINK_STATUS_DOT,
} from "@/components/DrinkWindowBadge";
import { drinkStatus, DRINK_STATUS_ORDER } from "@/lib/drink-window";
import type { Filters, SortOption, Wine } from "@/lib/types";
import { grapesInCellar } from "@/lib/grapes";
import { useLocale, useT, wineTypeLabel } from "@/lib/i18n";
import {
  countryDisplayName,
  countryFlagEmoji,
  formatPrice,
  uniqueSorted,
  winesForFacet,
} from "@/lib/wines";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
  total: number;
  wines: Wine[];
};

const fieldClass =
  "w-full min-h-[44px] rounded-[10px] border border-[rgba(20,18,16,0.1)] bg-[rgba(255,252,247,0.65)] px-3 py-2.5 outline-none transition focus:border-[rgba(122,36,48,0.45)]";

function niceCeil(n: number): number {
  if (n <= 500) return 500;
  return Math.ceil(n / 100) * 100;
}

function scoreBounds(
  scores: number[],
  fallbackMin = 3.0,
  fallbackMax = 4.5
) {
  const minRaw = scores.length ? Math.min(...scores) : fallbackMin;
  const maxRaw = scores.length ? Math.max(...scores) : fallbackMax;
  return {
    min: Math.max(2.5, Math.floor(minRaw * 10) / 10),
    max: Math.min(5, Math.ceil(maxRaw * 10) / 10),
  };
}

type DualRangeFieldProps = {
  label: ReactNode;
  bounds: { min: number; max: number };
  minValue: number;
  maxValue: number;
  step: number;
  displayLabel: string;
  formatBound: (n: number) => string;
  maxBoundSuffix?: string;
  onMin: (v: number) => void;
  onMax: (v: number) => void;
  minAria: string;
  maxAria: string;
};

/** Shared layout so Cavatale / Precio align across sm:grid-cols-2. */
function DualRangeField({
  label,
  bounds,
  minValue,
  maxValue,
  step,
  displayLabel,
  formatBound,
  maxBoundSuffix = "",
  onMin,
  onMax,
  minAria,
  maxAria,
}: DualRangeFieldProps) {
  const span = bounds.max - bounds.min || 1;
  const fillStart = ((minValue - bounds.min) / span) * 100;
  const fillEnd = ((maxValue - bounds.min) / span) * 100;

  return (
    <label className="flex min-w-0 flex-col">
      {/* Reserved 2-line slot keeps range cards aligned; items-end
          pins the title to the bottom so it reads with its slider, not the block above. */}
      <span className="mb-0.5 grid min-h-[2.5rem] grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:min-h-[2.75rem] sm:text-xs">
        <span className="leading-snug">{label}</span>
        <span className="shrink-0 normal-case tracking-normal text-ink">
          {displayLabel}
        </span>
      </span>
      <div className="flex min-h-[52px] flex-1 flex-col justify-center rounded-[10px] border border-[rgba(20,18,16,0.08)] bg-[rgba(255,252,247,0.55)] px-2.5 py-2 sm:px-3">
        <div
          className="dual-range"
          style={
            {
              "--fill-start": `${Math.min(100, Math.max(0, fillStart))}%`,
              "--fill-end": `${Math.min(100, Math.max(0, fillEnd))}%`,
            } as CSSProperties
          }
        >
          <div className="dual-range-track" aria-hidden />
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={step}
            value={minValue}
            onChange={(e) => onMin(Number(e.target.value))}
            aria-label={minAria}
            className="dual-range-input is-min"
          />
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={step}
            value={maxValue}
            onChange={(e) => onMax(Number(e.target.value))}
            aria-label={maxAria}
            className="dual-range-input is-max"
          />
        </div>
        <div className="mt-1 flex h-[1rem] items-center justify-between text-[10px] leading-none text-ink-soft">
          <span>{formatBound(bounds.min)}</span>
          <span>
            {formatBound(bounds.max)}
            {maxBoundSuffix}
          </span>
        </div>
      </div>
    </label>
  );
}

function ScoreRangeTitle({ name }: { name: string }) {
  const t = useT();
  return (
    <>
      {t("filters.rating")}{" "}
      <span className="sm:block">{name}</span>
    </>
  );
}

export function FiltersBar({ filters, onChange, total, wines }: Props) {
  const t = useT();
  const { dict, locale } = useLocale();
  /** Collapsed by default under xl (mapa/lista móvil); always expanded on desktop. */
  const [moreOpen, setMoreOpen] = useState(false);

  const sortOptions = useMemo(
    (): { value: SortOption; label: string }[] => [
      { value: "cavatale-desc", label: t("filters.sortCavataleDesc") },
      { value: "cavatale-asc", label: t("filters.sortCavataleAsc") },
      { value: "price-desc", label: t("filters.sortPriceDesc") },
      { value: "price-asc", label: t("filters.sortPriceAsc") },
      { value: "default", label: t("filters.sortOriginal") },
    ],
    [t]
  );

  const forCountry = useMemo(
    () => winesForFacet(wines, filters, ["country"]),
    [wines, filters]
  );
  const forType = useMemo(
    () => winesForFacet(wines, filters, ["type"]),
    [wines, filters]
  );
  const forGrape = useMemo(
    () => winesForFacet(wines, filters, ["grape"]),
    [wines, filters]
  );
  const forMoment = useMemo(
    () => winesForFacet(wines, filters, ["drinkMoment"]),
    [wines, filters]
  );

  const countries = useMemo(
    () => uniqueSorted(forCountry.map((w) => w.country)),
    [forCountry]
  );
  const types = useMemo(
    () => uniqueSorted(forType.map((w) => w.type)),
    [forType]
  );
  const grapes = useMemo(() => grapesInCellar(forGrape), [forGrape]);

  useEffect(() => {
    const next: Partial<Filters> = {};
    if (filters.country && !countries.includes(filters.country)) {
      next.country = "";
    }
    if (filters.type && !types.includes(filters.type)) {
      next.type = "";
    }
    if (filters.grape && !grapes.some((g) => g.name === filters.grape)) {
      next.grape = "";
    }
    if (Object.keys(next).length) {
      onChange({ ...filters, ...next });
    }
  }, [countries, types, grapes, filters, onChange]);

  const priceBounds = useMemo(() => {
    const prices = wines
      .map((w) => w.price)
      .filter((p): p is number => p != null && p > 0);
    const min = prices.length ? Math.min(...prices) : 200;
    const maxRaw = prices.length ? Math.max(...prices) : 2000;
    const max = niceCeil(Math.max(maxRaw, 500));
    const step = max > 1000 ? 50 : 25;
    return {
      min: Math.max(100, Math.floor(min / 50) * 50),
      max,
      step,
    };
  }, [wines]);

  const cavataleBounds = useMemo(
    () =>
      scoreBounds(
        wines
          .map((w) => w.cavataleRating)
          .filter((v): v is number => v != null)
      ),
    [wines]
  );

  const minValue = filters.minPrice ?? priceBounds.min;
  const maxValue = filters.maxPrice ?? priceBounds.max;
  const atPriceFloor =
    filters.minPrice == null || filters.minPrice <= priceBounds.min;
  const atPriceCeil =
    filters.maxPrice == null || filters.maxPrice >= priceBounds.max;
  const priceUnfiltered = atPriceFloor && atPriceCeil;

  const cavataleMin = filters.minCavatale ?? cavataleBounds.min;
  const cavataleMax = filters.maxCavatale ?? cavataleBounds.max;
  const cavataleUnfiltered =
    (filters.minCavatale == null ||
      filters.minCavatale <= cavataleBounds.min) &&
    (filters.maxCavatale == null ||
      filters.maxCavatale >= cavataleBounds.max);

  function patch(partial: Partial<Filters>) {
    onChange({ ...filters, ...partial });
  }

  function onMinPriceSlide(raw: number) {
    const value = Math.min(raw, maxValue);
    patch({
      minPrice: value <= priceBounds.min ? null : value,
      maxPrice: filters.maxPrice,
    });
  }

  function onMaxPriceSlide(raw: number) {
    const value = Math.max(raw, minValue);
    patch({
      minPrice: filters.minPrice,
      maxPrice: value >= priceBounds.max ? null : value,
    });
  }

  function onMinCavataleSlide(raw: number) {
    const rounded = Math.round(Math.min(raw, cavataleMax) * 10) / 10;
    patch({
      minCavatale: rounded <= cavataleBounds.min ? null : rounded,
      maxCavatale: filters.maxCavatale,
    });
  }

  function onMaxCavataleSlide(raw: number) {
    const rounded = Math.round(Math.max(raw, cavataleMin) * 10) / 10;
    patch({
      minCavatale: filters.minCavatale,
      maxCavatale: rounded >= cavataleBounds.max ? null : rounded,
    });
  }

  const anyLabel = t("filters.any");

  const priceLabel = priceUnfiltered
    ? anyLabel
    : `${formatPrice(minValue)} – ${formatPrice(maxValue)}${atPriceCeil ? "+" : ""}`;

  const cavataleLabel = cavataleUnfiltered
    ? anyLabel
    : `${cavataleMin.toFixed(1)} – ${cavataleMax.toFixed(1)}`;

  const countryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of forCountry) {
      map.set(w.country, (map.get(w.country) ?? 0) + 1);
    }
    return map;
  }, [forCountry]);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of forType) {
      map.set(w.type, (map.get(w.type) ?? 0) + 1);
    }
    return map;
  }, [forType]);

  const momentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of forMoment) {
      const s = drinkStatus(w);
      if (s === "unknown") continue;
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return map;
  }, [forMoment]);

  const activeExtra =
    (filters.country ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.grape ? 1 : 0) +
    (filters.drinkMoment ? 1 : 0) +
    (cavataleUnfiltered ? 0 : 1) +
    (priceUnfiltered ? 0 : 1) +
    (filters.sort !== "cavatale-desc" ? 1 : 0);

  return (
    <div className="panel-quiet p-2.5 sm:p-3">
      <div className="space-y-2.5 sm:space-y-3">
        <label className="block min-w-0">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
            {t("common.search")}
          </span>
          <input
            id="cellar-search"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder={t("filters.searchShortPlaceholder")}
            className={fieldClass}
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>

        <div className="flex items-center justify-between gap-3 xl:hidden">
          <button
            type="button"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] px-3 text-sm font-medium text-ink"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span>{moreOpen ? t("filters.hideMore") : t("filters.showMore")}</span>
            {activeExtra > 0 ? (
              <span className="rounded-full bg-[rgba(110,31,44,0.14)] px-2 py-0.5 text-[11px] font-medium text-[var(--wine-deep)]">
                {t("filters.activeCount", { count: activeExtra })}
              </span>
            ) : null}
            <span className="text-ink-soft" aria-hidden>
              {moreOpen ? "▴" : "▾"}
            </span>
          </button>
          <p className="shrink-0 text-sm text-ink-soft">
            {t("filters.results", { count: total })}
          </p>
        </div>

        <div
          className={[
            "space-y-2.5 sm:space-y-3",
            moreOpen ? "block" : "hidden xl:block",
          ].join(" ")}
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 lg:items-end">
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
                {t("filters.sort")}
              </span>
              <select
                value={filters.sort}
                onChange={(e) => patch({ sort: e.target.value as SortOption })}
                className={fieldClass}
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
                {t("filters.country")}
              </span>
              <select
                value={filters.country}
                onChange={(e) => patch({ country: e.target.value })}
                className={fieldClass}
              >
                <option value="">{t("filters.all")}</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {countryFlagEmoji[c]
                      ? `${countryFlagEmoji[c]} ${countryDisplayName(c, locale)}`
                      : countryDisplayName(c, locale)}
                    {` (${countryCounts.get(c) ?? 0})`}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
                {t("filters.type")}
              </span>
              <select
                value={filters.type}
                onChange={(e) => patch({ type: e.target.value })}
                className={fieldClass}
              >
                <option value="">{t("filters.all")}</option>
                {types.map((typeValue) => (
                  <option key={typeValue} value={typeValue}>
                    {wineTypeLabel(dict, typeValue)} ({typeCounts.get(typeValue) ?? 0})
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
                {t("filters.grape")}
              </span>
              <select
                value={filters.grape}
                onChange={(e) => patch({ grape: e.target.value })}
                className={fieldClass}
              >
                <option value="">{t("filters.allGrapes")}</option>
                {grapes.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name} ({g.count})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
              {t("filters.moment")}
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t("filters.moment")}
            >
              <button
                type="button"
                className={[
                  "inline-flex min-h-[32px] items-center rounded-[8px] border px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] transition",
                  filters.drinkMoment === ""
                    ? "border-[rgba(110,31,44,0.45)] bg-[rgba(110,31,44,0.12)] text-[var(--wine-deep)]"
                    : "border-[var(--line)] bg-[rgba(255,252,247,0.55)] text-ink-soft hover:border-[rgba(110,31,44,0.28)] hover:text-ink",
                ].join(" ")}
                aria-pressed={filters.drinkMoment === ""}
                onClick={() => patch({ drinkMoment: "" })}
              >
                {t("filters.momentAll")}
              </button>
              {DRINK_STATUS_ORDER.map((status) => {
                const count = momentCounts.get(status) ?? 0;
                const active = filters.drinkMoment === status;
                return (
                  <button
                    key={status}
                    type="button"
                    disabled={count === 0 && !active}
                    className={[
                      "inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] border px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] transition disabled:cursor-default disabled:opacity-40",
                      active
                        ? DRINK_STATUS_CLASS[status]
                        : "border-[var(--line)] bg-[rgba(255,252,247,0.55)] text-ink-soft hover:border-[rgba(110,31,44,0.28)] hover:text-ink",
                    ].join(" ")}
                    aria-pressed={active}
                    title={t(`drinkWindow.hint.${status}`)}
                    onClick={() =>
                      patch({ drinkMoment: active ? "" : status })
                    }
                  >
                    <span
                      className={[
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        DRINK_STATUS_DOT[status],
                      ].join(" ")}
                      aria-hidden
                    />
                    {t(`drinkWindow.status.${status}`)}
                    <span className="tabular-nums opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rangos: Calificación Cavatale · Precio */}
          <div className="grid grid-cols-1 items-stretch gap-x-2.5 gap-y-4 sm:grid-cols-2 sm:gap-y-2.5">
            <DualRangeField
              label={<ScoreRangeTitle name={t("wine.rating")} />}
              bounds={cavataleBounds}
              minValue={cavataleMin}
              maxValue={cavataleMax}
              step={0.1}
              displayLabel={cavataleLabel}
              formatBound={(n) => n.toFixed(1)}
              onMin={onMinCavataleSlide}
              onMax={onMaxCavataleSlide}
              minAria={t("filters.minCavataleAria")}
              maxAria={t("filters.maxCavataleAria")}
            />

            <DualRangeField
              label={t("wine.price")}
              bounds={priceBounds}
              minValue={minValue}
              maxValue={maxValue}
              step={priceBounds.step}
              displayLabel={priceLabel}
              formatBound={formatPrice}
              maxBoundSuffix="+"
              onMin={onMinPriceSlide}
              onMax={onMaxPriceSlide}
              minAria={t("filters.minPriceAria")}
              maxAria={t("filters.maxPriceAria")}
            />
          </div>

          <p className="hidden text-sm text-ink-soft xl:block">
            {t("filters.results", { count: total })}
          </p>
        </div>
      </div>
    </div>
  );
}
