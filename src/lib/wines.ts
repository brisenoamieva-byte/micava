import data from "@/data/wines.json";
import type { CellarData, Filters, SortOption, Wine } from "@/lib/types";
import { wineHasGrape } from "@/lib/grapes";
import { withKimiDefaults } from "@/lib/kimi-research";
import { withVerificationDefaults } from "@/lib/rating-verify";

export const cellar = data as unknown as CellarData;
export const seedWines: Wine[] = cellar.wines.map((w) =>
  withKimiDefaults(withVerificationDefaults({ ...w }))
);
/** @deprecated use seedWines or cellar store */
export const wines: Wine[] = seedWines;
export const GRID_COLS = cellar.meta.gridCols;
export const GRID_ROWS = cellar.meta.gridRows;

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatVivino(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

/** Same 1–5 display as Vivino; used for calificación Cavatale. */
export function formatCavataleRating(
  value: number | null | undefined
): string {
  return formatVivino(value);
}

export function getWineById(list: Wine[], id: string): Wine | undefined {
  return list.find((w) => w.id === id);
}

export function getWineBySlot(
  list: Wine[],
  slot: string,
  cellarId?: string | null
): Wine | undefined {
  return list.find((w) => {
    if (w.slot !== slot) return false;
    if (slot === "abajo") return true;
    if (cellarId === undefined) return true;
    return (w.cellarId ?? null) === (cellarId ?? null);
  });
}

export function parseLocation(location: string): {
  slot: string | null;
  col: number | null;
  row: string | null;
} {
  const value = location.trim();
  if (!value) return { slot: null, col: null, row: null };
  if (value.toLowerCase() === "abajo") {
    return { slot: "abajo", col: null, row: null };
  }
  const match = value.toUpperCase().match(/^(\d{1,2})([A-Z])$/);
  if (!match) return { slot: value, col: null, row: null };
  return {
    slot: `${Number(match[1])}${match[2]}`,
    col: Number(match[1]),
    row: match[2],
  };
}

export function getEmptySlots(
  list: Wine[],
  cols: number = GRID_COLS,
  rows: string[] = GRID_ROWS,
  cellarId?: string | null
): string[] {
  const occupied = new Set(
    list
      .filter((w) => {
        if (!w.slot || w.slot === "abajo") return false;
        if (cellarId === undefined) return true;
        return (w.cellarId ?? null) === (cellarId ?? null);
      })
      .map((w) => w.slot as string)
  );
  const empty: string[] = [];
  for (const row of rows) {
    for (let col = 1; col <= cols; col++) {
      const slot = `${col}${row}`;
      if (!occupied.has(slot)) empty.push(slot);
    }
  }
  return empty;
}

export function cellarStats(
  list: Wine[] = wines,
  opts?: { cols?: number; rows?: string[]; cellarId?: string | null }
) {
  const cols = opts?.cols ?? GRID_COLS;
  const rows = opts?.rows ?? GRID_ROWS;
  const withPrice = list.filter((w) => w.price != null);
  const value = withPrice.reduce((sum, w) => sum + (w.price ?? 0), 0);
  const countries = new Set(list.map((w) => w.country).filter(Boolean));
  const rated = list.filter((w) => w.vivino != null);
  const avgVivino =
    rated.length === 0
      ? null
      : rated.reduce((sum, w) => sum + (w.vivino ?? 0), 0) / rated.length;
  const cavataleRated = list.filter((w) => w.cavataleRating != null);
  const avgCavatale =
    cavataleRated.length === 0
      ? null
      : cavataleRated.reduce((sum, w) => sum + (w.cavataleRating ?? 0), 0) /
        cavataleRated.length;

  const inGrid =
    opts?.cellarId !== undefined
      ? list.filter((w) => (w.cellarId ?? null) === (opts.cellarId ?? null))
      : list;

  return {
    bottles: list.length,
    value,
    countries: countries.size,
    avgVivino,
    avgCavatale,
    emptySlots: getEmptySlots(inGrid, cols, rows, opts?.cellarId).length,
  };
}

export function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

function compareNullable(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: "asc" | "desc"
): number {
  const aMissing = a == null;
  const bMissing = b == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return direction === "asc" ? a - b : b - a;
}

export function sortWines(list: Wine[], sort: SortOption): Wine[] {
  if (sort === "default") return list;

  const copy = [...list];
  copy.sort((a, b) => {
    if (sort === "vivino-desc") return compareNullable(a.vivino, b.vivino, "desc");
    if (sort === "vivino-asc") return compareNullable(a.vivino, b.vivino, "asc");
    if (sort === "cavatale-desc")
      return compareNullable(a.cavataleRating, b.cavataleRating, "desc");
    if (sort === "cavatale-asc")
      return compareNullable(a.cavataleRating, b.cavataleRating, "asc");
    if (sort === "price-desc") return compareNullable(a.price, b.price, "desc");
    if (sort === "price-asc") return compareNullable(a.price, b.price, "asc");
    return 0;
  });
  return copy;
}

export function filterWines(list: Wine[], filters: Filters): Wine[] {
  const q = filters.query.trim().toLowerCase();

  const filtered = list.filter((w) => {
    if (filters.country && w.country !== filters.country) return false;
    if (filters.type && w.type !== filters.type) return false;
    if (filters.grape && !wineHasGrape(w, filters.grape)) return false;
    if (filters.minVivino != null && (w.vivino == null || w.vivino < filters.minVivino))
      return false;
    if (filters.maxVivino != null && (w.vivino == null || w.vivino > filters.maxVivino))
      return false;
    if (
      filters.minCavatale != null &&
      (w.cavataleRating == null || w.cavataleRating < filters.minCavatale)
    )
      return false;
    if (
      filters.maxCavatale != null &&
      (w.cavataleRating == null || w.cavataleRating > filters.maxCavatale)
    )
      return false;
    if (filters.minPrice != null && (w.price == null || w.price < filters.minPrice))
      return false;
    if (filters.maxPrice != null && (w.price == null || w.price > filters.maxPrice))
      return false;

    if (!q) return true;

    const hay = [
      w.name,
      w.winery,
      w.country,
      w.region,
      w.grape,
      w.aging,
      w.type,
      w.slot,
      String(w.vintage ?? ""),
    ]
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  });

  return sortWines(filtered, filters.sort);
}

/** Wines matching all filters except the omitted facet keys (for cascading option lists). */
export function winesForFacet(
  list: Wine[],
  filters: Filters,
  omit: Array<"country" | "type" | "grape">
): Wine[] {
  const next: Filters = {
    ...filters,
    sort: "default",
    country: omit.includes("country") ? "" : filters.country,
    type: omit.includes("type") ? "" : filters.type,
    grape: omit.includes("grape") ? "" : filters.grape,
  };
  return filterWines(list, next);
}

export {
  countryCode,
  countryDisplayName,
  countryFlagEmoji,
  countryIso,
  normalizeCountry,
  WINE_COUNTRIES,
  WINE_COUNTRY_NAMES,
  wineCountriesForPrompt,
} from "@/lib/wine-countries";

export function typeAccent(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("blanc")) return "#b8814a"; /* spark — candlelit copper */
  if (t.includes("ros")) return "#a04d56"; /* wine-soft */
  if (
    t.includes("espum") ||
    t.includes("spark") ||
    t.includes("cava") ||
    t.includes("champ")
  ) {
    return "#2f4234"; /* leaf */
  }
  return "#6a1a28"; /* wine */
}
