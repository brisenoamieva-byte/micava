import type { Wine } from "@/lib/types";

export type TodayPick = {
  wine: Wine;
  /** Short role title shown above the name */
  label: string;
  reason: string;
};

function wineKey(w: Wine): string {
  return [w.name, w.winery, w.vintage ?? ""]
    .map((s) => String(s).trim().toLowerCase())
    .join("|");
}

function inGrid(w: Wine): boolean {
  return Boolean(w.slot && w.slot !== "abajo");
}

/** Prefer the bottle that is easiest to grab / best rated among duplicates. */
function preferBottle(a: Wine, b: Wine): Wine {
  const aGrid = inGrid(a) ? 1 : 0;
  const bGrid = inGrid(b) ? 1 : 0;
  if (aGrid !== bGrid) return aGrid > bGrid ? a : b;
  const aV = a.vivino ?? 0;
  const bV = b.vivino ?? 0;
  if (aV !== bV) return aV > bV ? a : b;
  const aP = a.price ?? Number.POSITIVE_INFINITY;
  const bP = b.price ?? Number.POSITIVE_INFINITY;
  return aP <= bP ? a : b;
}

function uniqueBottles(wines: Wine[]): Wine[] {
  const map = new Map<string, Wine>();
  for (const w of wines) {
    const key = wineKey(w);
    const prev = map.get(key);
    map.set(key, prev ? preferBottle(prev, w) : w);
  }
  return [...map.values()];
}

function formatReason(parts: string[]): string {
  return parts.filter(Boolean).slice(0, 2).join(" · ");
}

/**
 * Three distinct “open tonight” roles — never the same wine twice
 * (duplicates of name/winery/vintage collapse to one bottle).
 */
export function picksForToday(wines: Wine[], limit = 3): TodayPick[] {
  const pool = uniqueBottles(wines);
  if (pool.length === 0) return [];

  const used = new Set<string>();
  const picks: TodayPick[] = [];

  function take(
    label: string,
    candidates: Wine[],
    reasonFn: (w: Wine) => string
  ): boolean {
    for (const w of candidates) {
      const key = wineKey(w);
      if (used.has(key)) continue;
      used.add(key);
      picks.push({ wine: w, label, reason: reasonFn(w) });
      return true;
    }
    return false;
  }

  const byEveryday = [...pool]
    .filter((w) => (w.vivino ?? 0) >= 3.7 && (w.price == null || w.price <= 500))
    .sort(
      (a, b) =>
        (b.vivino ?? 0) - (a.vivino ?? 0) ||
        (a.price ?? 9999) - (b.price ?? 9999) ||
        Number(inGrid(b)) - Number(inGrid(a))
    );

  const byBalance = [...pool].sort((a, b) => {
    const score = (w: Wine) => {
      const v = w.vivino ?? 3.5;
      const p = w.price ?? 600;
      return v * 100 - p / 12 + (inGrid(w) ? 8 : 0);
    };
    return score(b) - score(a);
  });

  const bySpecial = [...pool]
    .filter((w) => (w.vivino ?? 0) >= 4.0)
    .sort(
      (a, b) =>
        (b.vivino ?? 0) - (a.vivino ?? 0) ||
        (b.price ?? 0) - (a.price ?? 0) ||
        Number(inGrid(b)) - Number(inGrid(a))
    );

  // Prefer different countries across the three roles when possible
  function diversify(list: Wine[]): Wine[] {
    const countries = new Set(
      picks.map((p) => p.wine.country.trim().toLowerCase()).filter(Boolean)
    );
    const types = new Set(
      picks.map((p) => p.wine.type.trim().toLowerCase()).filter(Boolean)
    );
    return [...list].sort((a, b) => {
      const aNewC = countries.has(a.country.trim().toLowerCase()) ? 0 : 1;
      const bNewC = countries.has(b.country.trim().toLowerCase()) ? 0 : 1;
      if (aNewC !== bNewC) return bNewC - aNewC;
      const aNewT = types.has(a.type.trim().toLowerCase()) ? 0 : 1;
      const bNewT = types.has(b.type.trim().toLowerCase()) ? 0 : 1;
      return bNewT - aNewT;
    });
  }

  take("De diario", diversify(byEveryday), (w) =>
    formatReason([
      w.vivino != null ? `Vivino ${w.vivino.toFixed(1)}` : "",
      w.price != null ? "precio amable" : "",
      inGrid(w) ? `slot ${w.slot}` : "",
    ])
  );

  take("Equilibrio", diversify(byBalance), (w) =>
    formatReason([
      w.vivino != null ? `Vivino ${w.vivino.toFixed(1)}` : "",
      w.price != null ? "calidad / precio" : w.region || w.country,
      inGrid(w) ? `slot ${w.slot}` : "",
    ])
  );

  take("Especial", diversify(bySpecial.length ? bySpecial : byBalance), (w) =>
    formatReason([
      w.vivino != null ? `Vivino ${w.vivino.toFixed(1)}` : "",
      w.region || w.country,
      inGrid(w) ? `slot ${w.slot}` : "",
    ])
  );

  // Fill remaining slots with unused unique bottles (still no duplicates)
  if (picks.length < limit) {
    const filler = diversify(byBalance);
    for (const w of filler) {
      if (picks.length >= limit) break;
      take("Otra opción", [w], (x) =>
        formatReason([
          x.vivino != null ? `Vivino ${x.vivino.toFixed(1)}` : "",
          x.region || x.country || "en cava",
        ])
      );
    }
  }

  return picks.slice(0, limit);
}
