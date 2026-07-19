import type { CellarUnit, Wine } from "@/lib/types";
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

export type CellarInsights = {
  bottles: number;
  value: number;
  avgPrice: number | null;
  avgVivino: number | null;
  countries: number;
  regions: number;
  occupancy: number;
  emptySlots: number;
  totalSlots: number;
  byCountry: NamedCount[];
  byType: NamedCount[];
  byRegion: NamedCount[];
  vivinoBands: BandCount[];
  priceBands: BandCount[];
  vintages: { year: number; count: number }[];
  topByVivino: Wine[];
  topByPrice: Wine[];
  giftReady: Wine[];
  everyday: Wine[];
};

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function groupCount(
  items: Wine[],
  keyFn: (w: Wine) => string
): NamedCount[] {
  const map = new Map<string, { count: number; value: number }>();
  for (const w of items) {
    const key = keyFn(w) || "Sin dato";
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

export function buildInsights(
  wines: Wine[],
  cellars: CellarUnit[] = []
): CellarInsights {
  const withPrice = wines.filter((w) => w.price != null);
  const withVivino = wines.filter((w) => w.vivino != null);
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

  const vivinoDefs = [
    { label: "4.2+", test: (v: number) => v >= 4.2 },
    { label: "4.0–4.1", test: (v: number) => v >= 4.0 && v < 4.2 },
    { label: "3.7–3.9", test: (v: number) => v >= 3.7 && v < 4.0 },
    { label: "< 3.7", test: (v: number) => v < 3.7 },
  ];
  const vivinoBands: BandCount[] = vivinoDefs.map((b) => {
    const count = withVivino.filter((w) => b.test(w.vivino ?? 0)).length;
    return {
      label: b.label,
      count,
      share: withVivino.length ? count / withVivino.length : 0,
    };
  });

  const priceDefs = [
    { label: "Hasta $400", test: (p: number) => p <= 400 },
    { label: "$401–600", test: (p: number) => p > 400 && p <= 600 },
    { label: "$601–900", test: (p: number) => p > 600 && p <= 900 },
    { label: "Más de $900", test: (p: number) => p > 900 },
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

  const topByVivino = [...withVivino]
    .sort(
      (a, b) =>
        (b.vivino ?? 0) - (a.vivino ?? 0) || (b.price ?? 0) - (a.price ?? 0)
    )
    .slice(0, 5);

  const topByPrice = [...withPrice]
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, 5);

  const giftReady = [...wines]
    .filter((w) => (w.vivino ?? 0) >= 4.1 && (w.price ?? 0) >= 500)
    .sort(
      (a, b) =>
        (b.vivino ?? 0) - (a.vivino ?? 0) || (b.price ?? 0) - (a.price ?? 0)
    )
    .slice(0, 4);

  const everyday = [...wines]
    .filter((w) => (w.vivino ?? 0) >= 3.9 && (w.price ?? 9999) <= 500)
    .sort(
      (a, b) =>
        (b.vivino ?? 0) - (a.vivino ?? 0) || (a.price ?? 0) - (b.price ?? 0)
    )
    .slice(0, 4);

  return {
    bottles: wines.length,
    value,
    avgPrice: withPrice.length ? value / withPrice.length : null,
    avgVivino: withVivino.length
      ? sum(withVivino.map((w) => w.vivino ?? 0)) / withVivino.length
      : null,
    countries: new Set(wines.map((w) => w.country).filter(Boolean)).size,
    regions: new Set(wines.map((w) => w.region).filter(Boolean)).size,
    occupancy: totalSlots ? occupiedGrid / totalSlots : 0,
    emptySlots,
    totalSlots,
    byCountry: groupCount(wines, (w) => w.country),
    byType: groupCount(wines, (w) => w.type),
    byRegion: groupCount(wines, (w) => w.region).slice(0, 8),
    vivinoBands,
    priceBands,
    vintages,
    topByVivino,
    topByPrice,
    giftReady,
    everyday,
  };
}
