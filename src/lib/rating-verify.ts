import type {
  MatchConfidence,
  RatingSource,
  Wine,
} from "@/lib/types";

export type { MatchConfidence, RatingSource };

export type RatingVerification = {
  externalRating: number | null;
  ratingSource: RatingSource | null;
  lastCheckedAt: string | null;
  matchConfidence: MatchConfidence | null;
};

export const emptyVerification: RatingVerification = {
  externalRating: null,
  ratingSource: null,
  lastCheckedAt: null,
  matchConfidence: null,
};

export function wineTitleParts(wine: Pick<Wine, "name" | "winery">): {
  winery: string;
  name: string;
} {
  const winery = wine.winery.trim();
  let name = wine.name.trim();
  if (!winery || !name) return { winery, name };

  const wineryNorm = winery.toLowerCase();
  const nameNorm = name.toLowerCase();

  // "LAN" + "LAN A MANO" → name "A MANO" (avoid redundant / confusing tokens)
  if (nameNorm === wineryNorm) {
    name = "";
  } else if (nameNorm.startsWith(wineryNorm + " ")) {
    name = name.slice(winery.length).trim();
  }

  return { winery, name };
}

export function searchQueryForWine(wine: Wine): string {
  const { winery, name } = wineTitleParts(wine);
  const vintage = wine.vintage != null ? String(wine.vintage) : "";
  const title = [winery, name].filter(Boolean).join(" ") || wine.name.trim();
  return [title, vintage].filter(Boolean).join(" ").trim();
}

/** Title Case — Vivino typeahead ranks "Lan A Mano" better than "LAN A MANO". */
export function toSearchCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^[A-Z]{2,4}$/.test(w) && w.length <= 3) {
        // Keep short all-caps brands like "LAN" readable as "Lan"
        return w.charAt(0) + w.slice(1).toLowerCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Query as you'd type it in Vivino's box (short, title case).
 * Full dump into ?q= uses a worse ranker than the live typeahead.
 */
export function vivinoTypeQuery(wine: Wine): string {
  const { winery, name } = wineTitleParts(wine);
  const core = [winery, name].filter(Boolean).join(" ") || wine.name.trim();
  return toSearchCase(core);
}

/** Empty Vivino search page — paste/type there so typeahead kicks in. */
export function vivinoSearchHomeUrl(): string {
  return "https://www.vivino.com/search/wines";
}

/** Legacy direct ?q= URL (often worse matches than typing). */
export function vivinoSearchUrl(wine: Wine): string {
  const q = vivinoTypeQuery(wine);
  return `https://www.vivino.com/search/wines?q=${encodeURIComponent(q)}`;
}

/** Opens Wine-Searcher find page — no API; user copies the score back. */
export function wineSearcherUrl(wine: Wine): string {
  const title = searchQueryForWine({
    ...wine,
    vintage: null,
  });
  const vintage = wine.vintage != null ? String(wine.vintage) : "";
  return vintage
    ? `https://www.wine-searcher.com/find/${encodeURIComponent(title)}/${vintage}`
    : `https://www.wine-searcher.com/find/${encodeURIComponent(title)}`;
}

export function ratingDelta(
  stored: number | null,
  external: number | null
): number | null {
  if (stored == null || external == null) return null;
  return Math.round((external - stored) * 10) / 10;
}

export function formatCheckedAt(iso: string | null): string {
  if (!iso) return "Nunca";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const confidenceLabel: Record<MatchConfidence, string> = {
  confirmed: "Confirmado",
  likely: "Probable",
  uncertain: "Inseguro",
};

export const sourceLabel: Record<RatingSource, string> = {
  vivino: "Externa",
  "wine-searcher": "Wine-Searcher",
  manual: "Manual",
};

/** Ensure older localStorage wines have verification fields. */
export function withVerificationDefaults<T extends Partial<Wine>>(
  wine: T
): T & RatingVerification & { cellarId: string | null } {
  return {
    ...wine,
    cellarId: wine.cellarId ?? null,
    externalRating: wine.externalRating ?? null,
    ratingSource: wine.ratingSource ?? null,
    lastCheckedAt: wine.lastCheckedAt ?? null,
    matchConfidence: wine.matchConfidence ?? null,
  };
}
