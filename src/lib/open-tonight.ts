import { wineIdentityKey } from "@/lib/analytics";
import {
  drinkStatus,
  isInDrinkWindow,
  yearsFromPeak,
  type DrinkStatus,
} from "@/lib/drink-window";
import type { Wine } from "@/lib/types";

export type OpenTonightReasonKey =
  | "peak"
  | "ready"
  | "late"
  | "highScore"
  | "hasStory"
  | "hasPairing";

export type OpenTonightPick = {
  wine: Wine;
  score: number;
  status: DrinkStatus;
  reasonKeys: OpenTonightReasonKey[];
};

/** Plain-language “why this bottle” for Abrir hoy. */
export function formatOpenTonightWhy(
  pick: OpenTonightPick,
  t: (key: string, vars?: Record<string, string | number>) => string
): string | null {
  if (pick.reasonKeys.length === 0) return null;
  const parts = pick.reasonKeys.map((key) =>
    t(`stats.openTonightReasonPhrase.${key}`)
  );
  if (parts.length === 1) {
    return t("stats.openTonightWhyOne", { reason: parts[0]! });
  }
  return t("stats.openTonightWhyMany", {
    reasons: parts.slice(0, -1).join(", "),
    last: parts[parts.length - 1]!,
  });
}

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
 * Prefer peak → ready → late; hide young when better options exist.
 */
export function rankOpenTonight(
  wines: Wine[],
  limit = 5
): OpenTonightPick[] {
  const year = new Date().getFullYear();
  const unique = uniqueByIdentity(wines);
  const picks: OpenTonightPick[] = [];

  const hasActionable = unique.some((w) => {
    const s = drinkStatus(w, year);
    return s === "peak" || s === "ready" || s === "late";
  });

  for (const wine of unique) {
    const status = drinkStatus(wine, year);
    // If we already have drinkable bottles, don't clutter Abrir hoy with young ones.
    if (hasActionable && status === "young") continue;
    if (status === "unknown") continue;

    const reasonKeys: OpenTonightPick["reasonKeys"] = [];
    let score = 0;

    if (status === "peak") {
      score += 7;
      reasonKeys.push("peak");
    } else if (status === "ready") {
      score += 4.5;
      reasonKeys.push("ready");
    } else if (status === "late") {
      score += 3.2;
      reasonKeys.push("late");
    } else if (status === "young") {
      score += 0.4;
    }

    const fromPeak = yearsFromPeak(wine, year);
    if (fromPeak != null) {
      // Closer to peak = better among ready bottles.
      score += Math.max(0, 2.5 - Math.abs(fromPeak) * 0.55);
      // Slight urgency if past peak but still in window / late.
      if (fromPeak > 0 && (status === "ready" || status === "late")) {
        score += Math.min(1.2, fromPeak * 0.25);
      }
    }

    const rating = wine.cavataleRating;
    if (rating != null) {
      score += rating * 0.85;
      if (rating >= 3.8) reasonKeys.push("highScore");
    } else {
      score += 1.4; // unknown score — weaker than before so window wins
    }

    if (wine.kimiSummary || wine.kimiTalkHook) {
      score += 0.7;
      reasonKeys.push("hasStory");
    }
    if (wine.kimiPairings && wine.kimiPairings.length > 0) {
      score += 0.55;
      reasonKeys.push("hasPairing");
    }
    if (wine.slot && wine.slot !== "abajo") score += 0.35;
    if (wine.grape?.trim()) score += 0.15;

    if (!isInDrinkWindow(wine, year) && status !== "late") {
      score *= 0.55;
    }

    picks.push({ wine, score, status, reasonKeys });
  }

  // If everything was filtered (only young/unknown), fall back to best young.
  if (picks.length === 0) {
    for (const wine of unique) {
      const status = drinkStatus(wine, year);
      if (status === "unknown") continue;
      picks.push({
        wine,
        score: (wine.cavataleRating ?? 2) + (status === "young" ? 0.3 : 0),
        status,
        reasonKeys: [],
      });
    }
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

/** Cellar reference value + purchase vs market signal. */
export function cellarValueSnapshot(wines: Wine[]): {
  inventoryValue: number;
  pricedCount: number;
  kimiRefValue: number;
  kimiPricedCount: number;
  /** Sum of (kimiPrice - price) where both exist; positive = market above your tag. */
  vsMarketDelta: number;
  vsMarketCount: number;
  /** Sum of what you paid (`purchasePrice`). */
  purchaseTotal: number;
  purchaseCount: number;
  /**
   * Sum of (market - purchase) where purchase exists and market is
   * kimiPrice ?? price. Positive = market above what you paid.
   */
  purchaseGainDelta: number;
  purchaseGainCount: number;
} {
  let inventoryValue = 0;
  let pricedCount = 0;
  let kimiRefValue = 0;
  let kimiPricedCount = 0;
  let vsMarketDelta = 0;
  let vsMarketCount = 0;
  let purchaseTotal = 0;
  let purchaseCount = 0;
  let purchaseGainDelta = 0;
  let purchaseGainCount = 0;

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
    if (w.purchasePrice != null) {
      purchaseTotal += w.purchasePrice;
      purchaseCount += 1;
      const market = w.kimiPrice ?? w.price;
      if (market != null) {
        purchaseGainDelta += market - w.purchasePrice;
        purchaseGainCount += 1;
      }
    }
  }

  return {
    inventoryValue,
    pricedCount,
    kimiRefValue,
    kimiPricedCount,
    vsMarketDelta,
    vsMarketCount,
    purchaseTotal,
    purchaseCount,
    purchaseGainDelta,
    purchaseGainCount,
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
