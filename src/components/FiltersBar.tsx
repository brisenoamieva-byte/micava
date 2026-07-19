"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
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
  { value: "vivino-desc", label: "Vivino ↓ mayor" },
  { value: "vivino-asc", label: "Vivino ↑ menor" },
  { value: "price-desc", label: "Precio ↓ mayor" },
  { value: "price-asc", label: "Precio ↑ menor" },
  { value: "default", label: "Original" },
];

function niceCeil(n: number): number {
  if (n <= 500) return 500;
  return Math.ceil(n / 100) * 100;
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

  // Drop facet values that no longer exist under the other filters
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

  const vivinoBounds = useMemo(() => {
    const scores = wines
      .map((w) => w.vivino)
      .filter((v): v is number => v != null);
    const minRaw = scores.length ? Math.min(...scores) : 3.0;
    const maxRaw = scores.length ? Math.max(...scores) : 4.5;
    return {
      min: Math.max(2.5, Math.floor(minRaw * 10) / 10),
      max: Math.min(5, Math.ceil(maxRaw * 10) / 10),
    };
  }, [wines]);

  const minValue = filters.minPrice ?? priceBounds.min;
  const maxValue = filters.maxPrice ?? priceBounds.max;
  const atPriceFloor =
    filters.minPrice == null || filters.minPrice <= priceBounds.min;
  const atPriceCeil =
    filters.maxPrice == null || filters.maxPrice >= priceBounds.max;
  const priceUnfiltered = atPriceFloor && atPriceCeil;

  const vivinoMin = filters.minVivino ?? vivinoBounds.min;
  const vivinoMax = filters.maxVivino ?? vivinoBounds.max;
  const atVivinoFloor =
    filters.minVivino == null || filters.minVivino <= vivinoBounds.min;
  const atVivinoCeil =
    filters.maxVivino == null || filters.maxVivino >= vivinoBounds.max;
  const vivinoUnfiltered = atVivinoFloor && atVivinoCeil;

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

  const span = priceBounds.max - priceBounds.min || 1;
  const fillStart = ((minValue - priceBounds.min) / span) * 100;
  const fillEnd = ((maxValue - priceBounds.min) / span) * 100;

  const vivinoSpan = vivinoBounds.max - vivinoBounds.min || 1;
  const vivinoFillStart = ((vivinoMin - vivinoBounds.min) / vivinoSpan) * 100;
  const vivinoFillEnd = ((vivinoMax - vivinoBounds.min) / vivinoSpan) * 100;

  const priceLabel = priceUnfiltered
    ? "Cualquiera"
    : `${formatPrice(minValue)} – ${formatPrice(maxValue)}${atPriceCeil ? "+" : ""}`;

  const vivinoLabel = vivinoUnfiltered
    ? "Cualquiera"
    : `${vivinoMin.toFixed(1)} – ${vivinoMax.toFixed(1)}`;

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
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 xl:items-end">
        <label className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-4 xl:col-span-2">
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

        <label className="col-span-2 min-w-0 sm:col-span-1 lg:col-span-1 xl:col-span-1">
          <span className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
            <span>Vivino</span>
            <span className="normal-case tracking-normal text-ink">
              {vivinoLabel}
            </span>
          </span>
          <div className="flex min-h-[44px] flex-col justify-center rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.8)] px-3 py-2">
            <div
              className="dual-range"
              style={
                {
                  "--fill-start": `${Math.min(100, Math.max(0, vivinoFillStart))}%`,
                  "--fill-end": `${Math.min(100, Math.max(0, vivinoFillEnd))}%`,
                } as CSSProperties
              }
            >
              <div className="dual-range-track" aria-hidden />
              <input
                type="range"
                min={vivinoBounds.min}
                max={vivinoBounds.max}
                step={0.1}
                value={vivinoMin}
                onChange={(e) => onMinVivinoSlide(Number(e.target.value))}
                aria-label="Vivino mínimo"
                className="dual-range-input is-min"
              />
              <input
                type="range"
                min={vivinoBounds.min}
                max={vivinoBounds.max}
                step={0.1}
                value={vivinoMax}
                onChange={(e) => onMaxVivinoSlide(Number(e.target.value))}
                aria-label="Vivino máximo"
                className="dual-range-input is-max"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
              <span>{vivinoBounds.min.toFixed(1)}</span>
              <span>{vivinoBounds.max.toFixed(1)}</span>
            </div>
          </div>
        </label>

        <label className="col-span-2 min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-1">
          <span className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
            <span>Precio</span>
            <span className="normal-case tracking-normal text-ink">
              {priceLabel}
            </span>
          </span>
          <div className="flex min-h-[44px] flex-col justify-center rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.8)] px-3 py-2">
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
                min={priceBounds.min}
                max={priceBounds.max}
                step={priceBounds.step}
                value={minValue}
                onChange={(e) => onMinPriceSlide(Number(e.target.value))}
                aria-label="Precio mínimo"
                className="dual-range-input is-min"
              />
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step={priceBounds.step}
                value={maxValue}
                onChange={(e) => onMaxPriceSlide(Number(e.target.value))}
                aria-label="Precio máximo"
                className="dual-range-input is-max"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
              <span>{formatPrice(priceBounds.min)}</span>
              <span>{formatPrice(priceBounds.max)}+</span>
            </div>
          </div>
        </label>

        <div className="col-span-2 flex items-end pt-1 text-sm text-ink-soft sm:col-span-3 lg:col-span-4 xl:col-span-7">
          <span>{total} resultados</span>
        </div>
      </div>
    </div>
  );
}
