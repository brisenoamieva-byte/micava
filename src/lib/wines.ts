import data from "@/data/wines.json";
import type { CellarData, Filters, SortOption, Wine } from "@/lib/types";
import { wineHasGrape } from "@/lib/grapes";
import { withVerificationDefaults } from "@/lib/rating-verify";

export const cellar = data as unknown as CellarData;
export const seedWines: Wine[] = cellar.wines.map((w) =>
  withVerificationDefaults({ ...w })
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

  const inGrid =
    opts?.cellarId !== undefined
      ? list.filter((w) => (w.cellarId ?? null) === (opts.cellarId ?? null))
      : list;

  return {
    bottles: list.length,
    value,
    countries: countries.size,
    avgVivino,
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

export const countryCode: Record<string, string> = {
  España: "ES",
  México: "MX",
  Argentina: "AR",
  Chile: "CL",
  Francia: "FR",
  Italia: "IT",
  USA: "US",
  Australia: "AU",
};

/** ISO 3166-1 alpha-2 for flagcdn */
export const countryIso: Record<string, string> = {
  España: "es",
  México: "mx",
  Argentina: "ar",
  Chile: "cl",
  Francia: "fr",
  Italia: "it",
  USA: "us",
  Australia: "au",
};

export const countryFlagEmoji: Record<string, string> = {
  España: "🇪🇸",
  México: "🇲🇽",
  Argentina: "🇦🇷",
  Chile: "🇨🇱",
  Francia: "🇫🇷",
  Italia: "🇮🇹",
  USA: "🇺🇸",
  Australia: "🇦🇺",
};

export function typeAccent(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("blanco")) return "#c4a35a";
  if (t.includes("rosado")) return "#b85c6e";
  return "#6e1f2c";
}
