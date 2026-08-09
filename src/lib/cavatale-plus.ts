/**
 * Cavatale Plus — freemium design (measurement first, no paywall yet).
 *
 * Free tier keeps inventory, map, scan, and a monthly story budget.
 * Plus unlocks unlimited stories, Abrir hoy insights, drink windows depth,
 * cellar valuation refresh, and advanced bitácora later.
 */

export const CAVATALE_PLUS = {
  productName: "Cavatale Plus",
  /** Soft free quota for Contar historia / research-wine per calendar month. */
  freeStoriesPerMonth: 3,
  /** Soft free quota for price verify batch refreshes per month. */
  freePriceRefreshPerMonth: 5,
  /** Planned annual price (MXN) — display only until billing ships. */
  plannedPriceMxnYear: 599,
  plannedPriceUsdYear: 29,
  plusIncludes: [
    "storiesUnlimited",
    "openTonight",
    "drinkWindows",
    "valueRefresh",
    "bitacoraPlus",
  ] as const,
  freeIncludes: [
    "inventory",
    "map",
    "scan",
    "storiesQuota",
    "pairMeal",
  ] as const,
} as const;

export type CavatalePlusInclude = (typeof CAVATALE_PLUS.plusIncludes)[number];

/** Routes that count toward the free “story” quota. */
export const STORY_USAGE_ROUTES = ["research-wine"] as const;

export function countStoryCallsThisMonth(
  byRoute: Record<string, number> | null | undefined
): number {
  if (!byRoute) return 0;
  let n = 0;
  for (const route of STORY_USAGE_ROUTES) {
    n += byRoute[route] ?? 0;
  }
  return n;
}

export function freeStoryQuotaRemaining(
  used: number,
  limit = CAVATALE_PLUS.freeStoriesPerMonth
): number {
  return Math.max(0, limit - used);
}

export function isOverFreeStoryQuota(
  used: number,
  limit = CAVATALE_PLUS.freeStoriesPerMonth
): boolean {
  return used >= limit;
}
