import type { CellarLogEntry, CellarUnit, Wine } from "@/lib/types";
import { GRID_COLS, GRID_ROWS, getEmptySlots } from "@/lib/wines";

export type NamedCount = {
  name: string;
  count: number;
  value: number;
  share: number;
};

export type BandCount = {
  label: string;
  count: number;
  share: number;
};

/** Wine you liked (≥4★) that is gone or nearly gone from the cellar. */
export type ReplenishItem = {
  name: string;
  winery: string;
  country: string;
  myRating: number;
  note: string | null;
  /** Bottles still in inventory matching name+winery. */
  inStock: number;
  lastOpenedAt: string;
};

export type CellarInsights = {
  bottles: number;
  value: number;
  avgPrice: number | null;
  /** Mean Cavatale rating (bottles with a Cavatale score only). */
  avgCavatale: number | null;
  /** @deprecated Prefer avgCavatale; kept as alias for callers. */
  avgVivino: number | null;
  countries: number;
  regions: number;
  occupancy: number;
  emptySlots: number;
  totalSlots: number;
  /** Single-unit grid size, e.g. "12×6". Prefer `unitCount` + i18n for multi-unit. */
  occupancyLabel: string;
  unitCount: number;
  byCountry: NamedCount[];
  byType: NamedCount[];
  byRegion: NamedCount[];
  cavataleBands: BandCount[];
  /** @deprecated Prefer cavataleBands. */
  vivinoBands: BandCount[];
  priceBands: BandCount[];
  vintages: { year: number; count: number }[];
  topByCavatale: Wine[];
  /** @deprecated Prefer topByCavatale. */
  topByVivino: Wine[];
  topByPrice: Wine[];
  toReplenish: ReplenishItem[];
};

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

/** Collapse duplicate bottles (same name / winery / vintage / aging / grape). */
export function wineIdentityKey(
  w: Pick<Wine, "name" | "winery" | "vintage" | "aging" | "grape">
): string {
  return [w.name, w.winery, w.vintage ?? "", w.aging ?? "", w.grape ?? ""]
    .map((s) => String(s).trim().toLowerCase())
    .join("|");
}

/** Match catalog lines for replenishment (name + winery, any vintage). */
function replenishKey(w: { name: string; winery: string }): string {
  return [w.name, w.winery]
    .map((s) => String(s).trim().toLowerCase())
    .join("|");
}

function preferBottle(a: Wine, b: Wine): Wine {
  const aC = a.cavataleRating ?? 0;
  const bC = b.cavataleRating ?? 0;
  if (aC !== bC) return aC > bC ? a : b;
  return (a.price ?? 0) >= (b.price ?? 0) ? a : b;
}

/** Official quality score for dashboard ranking (Cavatale only). */
export function qualityScore(
  w: Pick<Wine, "cavataleRating">
): number | null {
  return w.cavataleRating ?? null;
}

function uniqueByIdentity(wines: Wine[]): Wine[] {
  const map = new Map<string, Wine>();
  for (const w of wines) {
    const key = wineIdentityKey(w);
    const prev = map.get(key);
    map.set(key, prev ? preferBottle(prev, w) : w);
  }
  return [...map.values()];
}

function groupCount(
  items: Wine[],
  keyFn: (w: Wine) => string
): NamedCount[] {
  const map = new Map<string, { count: number; value: number }>();
  for (const w of items) {
    const key = keyFn(w) || "__none__";
    const cur = map.get(key) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += w.price ?? 0;
    map.set(key, cur);
  }
  const total = items.length || 1;
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      count: v.count,
      value: v.value,
      share: v.count / total,
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
}

function buildReplenish(
  wines: Wine[],
  history: CellarLogEntry[]
): ReplenishItem[] {
  const stock = new Map<string, number>();
  for (const w of wines) {
    const key = replenishKey(w);
    stock.set(key, (stock.get(key) ?? 0) + 1);
  }

  const best = new Map<
    string,
    {
      name: string;
      winery: string;
      country: string;
      myRating: number;
      note: string | null;
      lastOpenedAt: string;
    }
  >();

  for (const e of history) {
    if (e.action !== "opened" || (e.myRating ?? 0) < 4) continue;
    const key = replenishKey(e.wine);
    const prev = best.get(key);
    if (
      !prev ||
      (e.myRating ?? 0) > prev.myRating ||
      ((e.myRating ?? 0) === prev.myRating && e.at > prev.lastOpenedAt)
    ) {
      best.set(key, {
        name: e.wine.name,
        winery: e.wine.winery,
        country: e.wine.country,
        myRating: e.myRating ?? 4,
        note: e.note,
        lastOpenedAt: e.at,
      });
    }
  }

  return [...best.entries()]
    .map(([key, meta]) => ({
      ...meta,
      inStock: stock.get(key) ?? 0,
    }))
    .filter((item) => item.inStock <= 1)
    .sort(
      (a, b) =>
        a.inStock - b.inStock ||
        b.myRating - a.myRating ||
        b.lastOpenedAt.localeCompare(a.lastOpenedAt)
    )
    .slice(0, 5);
}

export function buildInsights(
  wines: Wine[],
  cellars: CellarUnit[] = [],
  history: CellarLogEntry[] = []
): CellarInsights {
  const withPrice = wines.filter((w) => w.price != null);
  const withCavatale = wines.filter((w) => w.cavataleRating != null);
  const withQuality = wines.filter((w) => qualityScore(w) != null);
  const value = sum(withPrice.map((w) => w.price ?? 0));

  const units =
    cellars.length > 0
      ? cellars
      : [
          {
            id: "__default",
            name: "Principal",
            cols: GRID_COLS,
            rows: [...GRID_ROWS],
            sortOrder: 0,
          } satisfies CellarUnit,
        ];

  let emptySlots = 0;
  let totalSlots = 0;
  for (const unit of units) {
    totalSlots += unit.cols * unit.rows.length;
    emptySlots += getEmptySlots(wines, unit.cols, unit.rows, unit.id).length;
  }
  const occupiedGrid = totalSlots - emptySlots;

  const occupancyLabel =
    units.length === 1
      ? `${units[0].cols}×${units[0].rows.length}`
      : "";

  // Classification bands: only bottles with a real Cavatale rating.
  const scoreDefs = [
    { label: "4.2+", test: (v: number) => v >= 4.2 },
    { label: "4.0–4.1", test: (v: number) => v >= 4.0 && v < 4.2 },
    { label: "3.7–3.9", test: (v: number) => v >= 3.7 && v < 4.0 },
    { label: "< 3.7", test: (v: number) => v < 3.7 },
  ];
  const cavataleBands: BandCount[] = scoreDefs.map((b) => {
    const count = withCavatale.filter((w) =>
      b.test(w.cavataleRating ?? 0)
    ).length;
    return {
      label: b.label,
      count,
      share: withCavatale.length ? count / withCavatale.length : 0,
    };
  });

  const priceDefs = [
    { label: "priceUpTo400", test: (p: number) => p <= 400 },
    { label: "price401to600", test: (p: number) => p > 400 && p <= 600 },
    { label: "price601to900", test: (p: number) => p > 600 && p <= 900 },
    { label: "priceOver900", test: (p: number) => p > 900 },
  ];
  const priceBands: BandCount[] = priceDefs.map((b) => {
    const count = withPrice.filter((w) => b.test(w.price ?? 0)).length;
    return {
      label: b.label,
      count,
      share: withPrice.length ? count / withPrice.length : 0,
    };
  });

  const yearMap = new Map<number, number>();
  for (const w of wines) {
    if (w.vintage == null) continue;
    yearMap.set(w.vintage, (yearMap.get(w.vintage) ?? 0) + 1);
  }
  const vintages = [...yearMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  const topByCavatale = uniqueByIdentity(withQuality)
    .sort(
      (a, b) =>
        (qualityScore(b) ?? 0) - (qualityScore(a) ?? 0) ||
        (b.price ?? 0) - (a.price ?? 0)
    )
    .slice(0, 5);

  const topByPrice = uniqueByIdentity(withPrice)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, 5);

  // Only real Cavatale scores — never blend Vivino into “Media Cavatale”.
  const avgCavatale =
    withCavatale.length > 0
      ? sum(withCavatale.map((w) => w.cavataleRating ?? 0)) /
        withCavatale.length
      : null;

  return {
    bottles: wines.length,
    value,
    avgPrice: withPrice.length ? value / withPrice.length : null,
    avgCavatale,
    avgVivino: avgCavatale,
    countries: new Set(wines.map((w) => w.country).filter(Boolean)).size,
    regions: new Set(wines.map((w) => w.region).filter(Boolean)).size,
    occupancy: totalSlots ? occupiedGrid / totalSlots : 0,
    emptySlots,
    totalSlots,
    occupancyLabel,
    unitCount: units.length,
    byCountry: groupCount(wines, (w) => w.country),
    byType: groupCount(wines, (w) => w.type),
    byRegion: groupCount(wines, (w) => w.region).slice(0, 8),
    cavataleBands,
    vivinoBands: cavataleBands,
    priceBands,
    vintages,
    topByCavatale,
    topByVivino: topByCavatale,
    topByPrice,
    toReplenish: buildReplenish(wines, history),
  };
}
