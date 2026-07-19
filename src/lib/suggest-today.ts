import type { Wine } from "@/lib/types";

export type TodayPick = {
  wine: Wine;
  reason: string;
};

/**
 * Simple “open tonight” picks: good Vivino, reachable price, prefer in-grid.
 */
export function picksForToday(wines: Wine[], limit = 3): TodayPick[] {
  if (wines.length === 0) return [];

  const scored = wines.map((w) => {
    const vivino = w.vivino ?? 3.4;
    const price = w.price;
    let score = vivino * 14;
    const reasons: string[] = [];

    if (vivino >= 4.1) {
      score += 10;
      reasons.push(`Vivino ${vivino.toFixed(1)}`);
    } else if (vivino >= 3.9) {
      score += 5;
      reasons.push(`Vivino ${vivino.toFixed(1)}`);
    }

    if (price != null && price <= 450) {
      score += 12;
      reasons.push("precio amable");
    } else if (price != null && price <= 650) {
      score += 6;
      reasons.push("buen equilibrio");
    } else if (price == null) {
      score += 2;
    }

    if (w.slot && w.slot !== "abajo") {
      score += 5;
      reasons.push(`slot ${w.slot}`);
    }

    if (w.type === "Tinto") score += 1;

    if (reasons.length === 0) {
      reasons.push(w.region || w.country || "en cava");
    }

    return {
      wine: w,
      score,
      reason: reasons.slice(0, 2).join(" · "),
    };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (b.wine.vivino ?? 0) - (a.wine.vivino ?? 0) ||
      a.wine.name.localeCompare(b.wine.name, "es")
  );

  // Prefer variety of countries in the top picks
  const picked: TodayPick[] = [];
  const seenCountries = new Set<string>();
  for (const item of scored) {
    if (picked.length >= limit) break;
    if (
      seenCountries.has(item.wine.country) &&
      picked.length < limit - 1 &&
      scored.length > limit
    ) {
      continue;
    }
    seenCountries.add(item.wine.country);
    picked.push({ wine: item.wine, reason: item.reason });
  }

  // Fill if variety filter left gaps
  if (picked.length < limit) {
    for (const item of scored) {
      if (picked.length >= limit) break;
      if (picked.some((p) => p.wine.id === item.wine.id)) continue;
      picked.push({ wine: item.wine, reason: item.reason });
    }
  }

  return picked;
}
