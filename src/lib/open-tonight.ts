import { wineIdentityKey } from "@/lib/analytics";
import {
  drinkStatus,
  isInDrinkWindow,
  type DrinkStatus,
} from "@/lib/drink-window";
import type { Wine } from "@/lib/types";

export type OpenTonightPick = {
  wine: Wine;
  score: number;
  status: DrinkStatus;
  reasonKeys: Array<"peak" | "ready" | "highScore" | "hasStory" | "hasPairing">;
};

function preferBottle(a: Wine, b: Wine): Wine {
  const aC = a.cavataleRating ?? 0;
  const bC = b.cavataleRating ?? 0;
  if (aC !== bC) return aC > bC ? a : b;
  return (a.price ?? 0) >= (b.price ?? 0) ? a : b;
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

/**
 * Rank bottles to open tonight / this week.
 * Favors drink window + Cavatale score + existing story/pairings.
 */
export function rankOpenTonight(
  wines: Wine[],
  limit = 5
): OpenTonightPick[] {
  const year = new Date().getFullYear();
  const picks: OpenTonightPick[] = [];

  for (const wine of uniqueByIdentity(wines)) {
    const status = drinkStatus(wine, year);
    const reasonKeys: OpenTonightPick["reasonKeys"] = [];
    let score = 0;

    if (status === "peak") {
      score += 4;
      reasonKeys.push("peak");
    } else if (status === "ready") {
      score += 3;
      reasonKeys.push("ready");
    } else if (status === "young") {
      score += 0.5;
    } else if (status === "late") {
      score += 1.5; // open before it fades further
    }

    const rating = wine.cavataleRating;
    if (rating != null) {
      score += rating;
      if (rating >= 3.8) reasonKeys.push("highScore");
    } else {
      score += 2.2; // unknown story — still a candidate
    }

    if (wine.kimiSummary || wine.kimiTalkHook) {
      score += 0.8;
      reasonKeys.push("hasStory");
    }
    if (wine.kimiPairings && wine.kimiPairings.length > 0) {
      score += 0.6;
      reasonKeys.push("hasPairing");
    }
    if (wine.slot && wine.slot !== "abajo") score += 0.2;

    // Prefer in-window bottles, but always surface something if cellar has stock.
    if (!isInDrinkWindow(wine, year) && status !== "late") {
      score *= 0.72;
    }

    picks.push({ wine, score, status, reasonKeys });
  }

  return picks
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.wine.cavataleRating ?? 0) - (a.wine.cavataleRating ?? 0) ||
        a.wine.name.localeCompare(b.wine.name, "es")
    )
    .slice(0, limit);
}

/** Cellar reference value + optional kimi uplift signal. */
export function cellarValueSnapshot(wines: Wine[]): {
  inventoryValue: number;
  pricedCount: number;
  kimiRefValue: number;
  kimiPricedCount: number;
  /** Sum of (kimiPrice - price) where both exist; positive = market above your tag. */
  vsMarketDelta: number;
  vsMarketCount: number;
} {
  let inventoryValue = 0;
  let pricedCount = 0;
  let kimiRefValue = 0;
  let kimiPricedCount = 0;
  let vsMarketDelta = 0;
  let vsMarketCount = 0;

  for (const w of wines) {
    if (w.price != null) {
      inventoryValue += w.price;
      pricedCount += 1;
    }
    if (w.kimiPrice != null) {
      kimiRefValue += w.kimiPrice;
      kimiPricedCount += 1;
    }
    if (w.price != null && w.kimiPrice != null) {
      vsMarketDelta += w.kimiPrice - w.price;
      vsMarketCount += 1;
    }
  }

  return {
    inventoryValue,
    pricedCount,
    kimiRefValue,
    kimiPricedCount,
    vsMarketDelta,
    vsMarketCount,
  };
}

/** Up to `limit` unique bottles needing a fresher price reference. */
export function winesNeedingPriceRefresh(
  wines: Wine[],
  limit = 5
): Wine[] {
  const staleMs = 45 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const unique = uniqueByIdentity(wines);

  const scored = unique.map((w) => {
    let urgency = 0;
    if (w.price == null && w.kimiPrice == null) urgency += 3;
    else if (w.price == null) urgency += 2;
    else if (w.kimiPrice == null) urgency += 1.5;
    if (w.kimiCheckedAt) {
      const age = now - Date.parse(w.kimiCheckedAt);
      if (!Number.isFinite(age) || age > staleMs) urgency += 1;
    } else {
      urgency += 0.5;
    }
    urgency += (w.cavataleRating ?? 2.5) / 5;
    return { w, urgency };
  });

  return scored
    .filter((x) => x.urgency >= 1.5)
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, limit)
    .map((x) => x.w);
}
