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

export function searchQueryForWine(wine: Wine): string {
  const winery = wine.winery.trim();
  const name = wine.name.trim();
  const vintage = wine.vintage != null ? String(wine.vintage) : "";

  let title = name || winery;
  if (winery && name) {
    const wineryNorm = winery.toLowerCase();
    const nameNorm = name.toLowerCase();
    if (nameNorm === wineryNorm || nameNorm.startsWith(wineryNorm + " ")) {
      title = name;
    } else if (wineryNorm.startsWith(nameNorm)) {
      title = winery;
    } else {
      title = `${winery} ${name}`;
    }
  }

  return [title, vintage].filter(Boolean).join(" ").trim();
}

/** Opens Vivino search — no API; user copies the score back. */
export function vivinoSearchUrl(wine: Wine): string {
  const q = searchQueryForWine(wine);
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
  vivino: "Vivino",
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
