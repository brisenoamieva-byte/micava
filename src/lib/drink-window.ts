import type { Wine } from "@/lib/types";

/** Heuristic drinking window (years from vintage), not a lab aging model. */
export type DrinkWindow = {
  drinkFrom: number;
  drinkPeak: number;
  drinkBy: number;
};

export type DrinkStatus = "young" | "ready" | "peak" | "late" | "unknown";

const CURRENT_YEAR = () => new Date().getFullYear();

function clampYear(n: number): number {
  return Math.round(n);
}

function baseSpan(type: string, aging: string): {
  from: number;
  peak: number;
  by: number;
} {
  const t = type.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const a = aging.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const isSparkling =
    /espumos|sparkling|champagne|cava|prosecco|cremant/.test(t);
  const isWhite = /blanc|white|blanco/.test(t);
  const isRose = /rosa|rosado|rose|rosé/.test(t);
  const isFortified = /jerez|sherry|oporto|port|madeira|fortif/.test(t);
  const isAged =
    /gran\s*reserva|reserva|crianza|barrica|oak|vieilles?\s*vignes|old\s*vines/.test(
      a
    );
  const isGran = /gran\s*reserva|extra\s*aged|premier\s*cru|grand\s*cru/.test(
    a
  );

  if (isFortified) return { from: 5, peak: 15, by: 40 };
  if (isSparkling) return { from: 0, peak: 2, by: 6 };
  if (isRose) return { from: 0, peak: 1, by: 3 };
  if (isWhite) {
    if (isGran || isAged) return { from: 2, peak: 6, by: 12 };
    return { from: 0, peak: 2, by: 5 };
  }
  // Tinto / default
  if (isGran) return { from: 5, peak: 12, by: 25 };
  if (isAged) return { from: 3, peak: 8, by: 18 };
  return { from: 1, peak: 4, by: 10 };
}

/** Compute drink window years from vintage + type + aging text. */
export function computeDrinkWindow(
  wine: Pick<Wine, "vintage" | "type" | "aging">
): DrinkWindow | null {
  if (wine.vintage == null || !Number.isFinite(wine.vintage)) return null;
  const span = baseSpan(wine.type || "", wine.aging || "");
  const v = wine.vintage;
  return {
    drinkFrom: clampYear(v + span.from),
    drinkPeak: clampYear(v + span.peak),
    drinkBy: clampYear(v + span.by),
  };
}

/** Where the bottle sits relative to its heuristic window. */
export function drinkStatus(
  wine: Pick<Wine, "vintage" | "type" | "aging">,
  year = CURRENT_YEAR()
): DrinkStatus {
  const w = computeDrinkWindow(wine);
  if (!w) return "unknown";
  if (year < w.drinkFrom) return "young";
  if (year > w.drinkBy) return "late";
  // Peak band: within ±1 year of drinkPeak, still inside window.
  if (Math.abs(year - w.drinkPeak) <= 1) return "peak";
  if (year >= w.drinkFrom && year <= w.drinkBy) return "ready";
  return "unknown";
}

/** Bottles in their ready/peak window (good candidates to open). */
export function isInDrinkWindow(
  wine: Pick<Wine, "vintage" | "type" | "aging">,
  year = CURRENT_YEAR()
): boolean {
  const s = drinkStatus(wine, year);
  return s === "ready" || s === "peak";
}

/** Display order for Pulse: most actionable first. */
export const DRINK_STATUS_ORDER: DrinkStatus[] = [
  "peak",
  "ready",
  "late",
  "young",
];

export type DrinkStatusGroup = {
  status: DrinkStatus;
  wines: Wine[];
};

/** Group cellar bottles by drink-window moment (skips unknown). */
export function groupWinesByDrinkStatus(
  wines: Wine[],
  year = CURRENT_YEAR()
): DrinkStatusGroup[] {
  const buckets: Record<DrinkStatus, Wine[]> = {
    peak: [],
    ready: [],
    late: [],
    young: [],
    unknown: [],
  };
  for (const wine of wines) {
    buckets[drinkStatus(wine, year)].push(wine);
  }
  for (const status of DRINK_STATUS_ORDER) {
    buckets[status].sort((a, b) => {
      const ra = a.cavataleRating ?? 0;
      const rb = b.cavataleRating ?? 0;
      if (rb !== ra) return rb - ra;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }
  return DRINK_STATUS_ORDER.filter((s) => buckets[s].length > 0).map(
    (status) => ({ status, wines: buckets[status] })
  );
}
