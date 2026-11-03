import type { Wine } from "@/lib/types";

/** Heuristic drinking window (years from vintage), not a lab aging model. */
export type DrinkWindow = {
  drinkFrom: number;
  drinkPeak: number;
  drinkBy: number;
};

export type DrinkStatus = "young" | "ready" | "peak" | "late" | "unknown";

export type DrinkWineInput = Pick<
  Wine,
  "vintage" | "type" | "aging" | "grape" | "region" | "country"
>;

const CURRENT_YEAR = () => new Date().getFullYear();

function clampYear(n: number): number {
  return Math.round(n);
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function baseSpan(type: string, aging: string): {
  from: number;
  peak: number;
  by: number;
} {
  const t = norm(type);
  const a = norm(aging);
  const isSparkling =
    /espumos|sparkling|champagne|cava|prosecco|cremant/.test(t);
  const isWhite = /blanc|white|blanco/.test(t);
  const isRose = /rosa|rosado|rose/.test(t);
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

/**
 * Grape / region nudges on top of type+aging spans.
 * Keeps the model simple but closer to how collectors think.
 */
function grapeRegionNudge(
  grape: string,
  region: string,
  country: string
): { from: number; peak: number; by: number } {
  const g = norm(grape);
  const r = norm(`${region} ${country}`);
  let from = 0;
  let peak = 0;
  let by = 0;

  if (
    /nebbiolo|sangiovese|brunello|barolo|barbaresco|amarone|aglianico|agiorgitiko/.test(
      g
    ) ||
    /barolo|barbaresco|brunello|chianti\s*classico|amarone/.test(r)
  ) {
    from += 2;
    peak += 4;
    by += 8;
  } else if (
    /cabernet|bordeaux|merlot|petit\s*verdot|carmenere|malbec/.test(g) ||
    /bordeaux|medoc|pauillac|saint[- ]emilion|mendoza|maipu/.test(r)
  ) {
    from += 1;
    peak += 2;
    by += 5;
  } else if (/syrah|shiraz|mourvedre|monastrell|grenache|garnacha/.test(g)) {
    from += 1;
    peak += 2;
    by += 4;
  } else if (/tempranillo|tinto\s*fino|tinta\s*del\s*pais/.test(g)) {
    // Aging text already stretches reserva; grape alone is mid-weight.
    peak += 1;
    by += 2;
  } else if (/pinot\s*noir|pinot\s*nero/.test(g)) {
    from -= 0;
    peak -= 1;
    by -= 2;
  } else if (/gamay|beaujolais/.test(g) || /beaujolais/.test(r)) {
    from -= 1;
    peak -= 2;
    by -= 4;
  } else if (/riesling/.test(g)) {
    // Age-worthy white: stretch beyond default blanco.
    from += 1;
    peak += 4;
    by += 10;
  } else if (
    /sauvignon|verdejo|albarino|albariño|pinot\s*grigio|pinot\s*gris|txakoli/.test(
      g
    )
  ) {
    peak -= 1;
    by -= 2;
  } else if (/chenin|semillon|sémillon/.test(g)) {
    peak += 2;
    by += 5;
  }

  return { from, peak, by };
}

function applyNudge(
  span: { from: number; peak: number; by: number },
  nudge: { from: number; peak: number; by: number }
) {
  const from = Math.max(0, span.from + nudge.from);
  let peak = Math.max(from, span.peak + nudge.peak);
  let by = Math.max(peak + 1, span.by + nudge.by);
  // Keep a sensible shape: from ≤ peak ≤ by
  if (peak < from) peak = from;
  if (by <= peak) by = peak + 2;
  return { from, peak, by };
}

/** Compute drink window years from vintage + type + aging (+ grape/region). */
export function computeDrinkWindow(
  wine: DrinkWineInput
): DrinkWindow | null {
  if (wine.vintage == null || !Number.isFinite(wine.vintage)) return null;
  const span = applyNudge(
    baseSpan(wine.type || "", wine.aging || ""),
    grapeRegionNudge(wine.grape || "", wine.region || "", wine.country || "")
  );
  const v = wine.vintage;
  return {
    drinkFrom: clampYear(v + span.from),
    drinkPeak: clampYear(v + span.peak),
    drinkBy: clampYear(v + span.by),
  };
}

/** Peak band width: longer-lived bottles get a slightly wider “en pico”. */
function peakBandHalfWidth(win: DrinkWindow): number {
  const span = win.drinkBy - win.drinkFrom;
  if (span >= 15) return 2;
  return 1;
}

/** Where the bottle sits relative to its heuristic window. */
export function drinkStatus(
  wine: DrinkWineInput,
  year = CURRENT_YEAR()
): DrinkStatus {
  const w = computeDrinkWindow(wine);
  if (!w) return "unknown";
  if (year < w.drinkFrom) return "young";
  if (year > w.drinkBy) return "late";
  const band = peakBandHalfWidth(w);
  if (Math.abs(year - w.drinkPeak) <= band) return "peak";
  if (year >= w.drinkFrom && year <= w.drinkBy) return "ready";
  return "unknown";
}

/** Bottles in their ready/peak window (good candidates to open). */
export function isInDrinkWindow(
  wine: DrinkWineInput,
  year = CURRENT_YEAR()
): boolean {
  const s = drinkStatus(wine, year);
  return s === "ready" || s === "peak";
}

/** Signed years from estimated peak (negative = before peak). */
export function yearsFromPeak(
  wine: DrinkWineInput,
  year = CURRENT_YEAR()
): number | null {
  const w = computeDrinkWindow(wine);
  if (!w) return null;
  return year - w.drinkPeak;
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

/** Count bottles currently at peak. */
export function countPeakBottles(
  wines: DrinkWineInput[],
  year = CURRENT_YEAR()
): number {
  return wines.filter((w) => drinkStatus(w, year) === "peak").length;
}
