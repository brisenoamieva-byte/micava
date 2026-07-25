"use client";

import {
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Filters, SortOption, Wine } from "@/lib/types";
import { grapesInCellar } from "@/lib/grapes";
import {
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
  "w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.8)] px-3 py-2.5 outline-none transition focus:border-[rgba(122,36,48,0.45)]";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "cavatale-desc", label: "Calif. Cavatale ↓" },
  { value: "cavatale-asc", label: "Calif. Cavatale ↑" },
  { value: "vivino-desc", label: "Calif. Vivino ↓" },
  { value: "vivino-asc", label: "Calif. Vivino ↑" },
  { value: "price-desc", label: "Precio ↓" },
  { value: "price-asc", label: "Precio ↑" },
  { value: "default", label: "Original" },
];

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

/** Shared layout so Vivino / Cavatale / Precio align across sm:grid-cols-3. */
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
      {/* Reserved 2-line title slot so short labels (Precio) match wrapped ones */}
      <span className="mb-1 grid min-h-[2.5rem] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:min-h-[2.75rem] sm:text-xs">
        <span className="leading-snug">{label}</span>
        <span className="shrink-0 self-start pt-px normal-case tracking-normal text-ink">
          {displayLabel}
        </span>
      </span>
      <div className="flex min-h-[52px] flex-1 flex-col justify-center rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.8)] px-2.5 py-2 sm:px-3">
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
  return (
    <>
      Calificación{" "}
      <span className="sm:block">{name}</span>
    </>
  );
}

export function FiltersBar({ filters, onChange, total, wines }: Props) {
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

  const vivinoBounds = useMemo(
    () =>
      scoreBounds(
        wines.map((w) => w.vivino).filter((v): v is number => v != null)
      ),
    [wines]
  );

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

  const vivinoMin = filters.minVivino ?? vivinoBounds.min;
  const vivinoMax = filters.maxVivino ?? vivinoBounds.max;
  const vivinoUnfiltered =
    (filters.minVivino == null || filters.minVivino <= vivinoBounds.min) &&
    (filters.maxVivino == null || filters.maxVivino >= vivinoBounds.max);

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

  function onMinVivinoSlide(raw: number) {
    const rounded = Math.round(Math.min(raw, vivinoMax) * 10) / 10;
    patch({
      minVivino: rounded <= vivinoBounds.min ? null : rounded,
      maxVivino: filters.maxVivino,
    });
  }

  function onMaxVivinoSlide(raw: number) {
    const rounded = Math.round(Math.max(raw, vivinoMin) * 10) / 10;
    patch({
      minVivino: filters.minVivino,
      maxVivino: rounded >= vivinoBounds.max ? null : rounded,
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

  const priceLabel = priceUnfiltered
    ? "Cualquiera"
    : `${formatPrice(minValue)} – ${formatPrice(maxValue)}${atPriceCeil ? "+" : ""}`;

  const vivinoLabel = vivinoUnfiltered
    ? "Cualquiera"
    : `${vivinoMin.toFixed(1)} – ${vivinoMax.toFixed(1)}`;

  const cavataleLabel = cavataleUnfiltered
    ? "Cualquiera"
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

  return (
    <div className="panel p-3 sm:p-4">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
          <label className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
              Buscar
            </span>
            <input
              value={filters.query}
              onChange={(e) => patch({ query: e.target.value })}
              placeholder="Nombre, uva, región…"
              className={fieldClass}
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </label>

          <label className="min-w-0">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
              Ordenar
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
              País
            </span>
            <select
              value={filters.country}
              onChange={(e) => patch({ country: e.target.value })}
              className={fieldClass}
            >
              <option value="">Todos</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryFlagEmoji[c] ? `${countryFlagEmoji[c]} ${c}` : c}
                  {` (${countryCounts.get(c) ?? 0})`}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
              Tipo
            </span>
            <select
              value={filters.type}
              onChange={(e) => patch({ type: e.target.value })}
              className={fieldClass}
            >
              <option value="">Todos</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t} ({typeCounts.get(t) ?? 0})
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
              Uva
            </span>
            <select
              value={filters.grape}
              onChange={(e) => patch({ grape: e.target.value })}
              className={fieldClass}
            >
              <option value="">Todas</option>
              {grapes.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name} ({g.count})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Tres rangos: Calificación Vivino · Calificación Cavatale · Precio */}
        <div className="grid grid-cols-1 items-stretch gap-2.5 sm:grid-cols-3">
          <DualRangeField
            label={<ScoreRangeTitle name="Vivino" />}
            bounds={vivinoBounds}
            minValue={vivinoMin}
            maxValue={vivinoMax}
            step={0.1}
            displayLabel={vivinoLabel}
            formatBound={(n) => n.toFixed(1)}
            onMin={onMinVivinoSlide}
            onMax={onMaxVivinoSlide}
            minAria="Calificación Vivino mínima"
            maxAria="Calificación Vivino máxima"
          />

          <DualRangeField
            label={<ScoreRangeTitle name="Cavatale" />}
            bounds={cavataleBounds}
            minValue={cavataleMin}
            maxValue={cavataleMax}
            step={0.1}
            displayLabel={cavataleLabel}
            formatBound={(n) => n.toFixed(1)}
            onMin={onMinCavataleSlide}
            onMax={onMaxCavataleSlide}
            minAria="Calificación Cavatale mínima"
            maxAria="Calificación Cavatale máxima"
          />

          <DualRangeField
            label="Precio"
            bounds={priceBounds}
            minValue={minValue}
            maxValue={maxValue}
            step={priceBounds.step}
            displayLabel={priceLabel}
            formatBound={formatPrice}
            maxBoundSuffix="+"
            onMin={onMinPriceSlide}
            onMax={onMaxPriceSlide}
            minAria="Precio mínimo"
            maxAria="Precio máximo"
          />
        </div>

        <p className="text-sm text-ink-soft">{total} resultados</p>
      </div>
    </div>
  );
}
