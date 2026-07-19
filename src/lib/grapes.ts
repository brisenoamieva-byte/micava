import type { Wine } from "@/lib/types";

/** Canonical grape names shown in the filter */
export const CANONICAL_GRAPES = [
  "Tempranillo",
  "Cabernet Sauvignon",
  "Merlot",
  "Malbec",
  "Syrah",
  "Garnacha",
  "Nebbiolo",
  "Zinfandel",
  "Chardonnay",
  "Chenin Blanc",
  "Colombard",
  "Muscat",
  "Cariñena",
  "Monastrell",
  "Mourvèdre",
  "Petite Sirah",
  "Graciano",
  "Mazuelo",
  "Barbera",
] as const;

export type CanonicalGrape = (typeof CANONICAL_GRAPES)[number];

/** Alias → canonical (lowercase keys) */
const ALIASES: Record<string, CanonicalGrape> = {
  tempranillo: "Tempranillo",
  "cabernet sauvignon": "Cabernet Sauvignon",
  cabernet: "Cabernet Sauvignon",
  merlot: "Merlot",
  malbec: "Malbec",
  syrah: "Syrah",
  shiraz: "Syrah",
  garnacha: "Garnacha",
  grenache: "Garnacha",
  granache: "Garnacha",
  nebbiolo: "Nebbiolo",
  zinfandel: "Zinfandel",
  chardonnay: "Chardonnay",
  chardonay: "Chardonnay",
  "chenin blanc": "Chenin Blanc",
  chenin: "Chenin Blanc",
  colombard: "Colombard",
  "french colombard": "Colombard",
  muscat: "Muscat",
  cariñena: "Cariñena",
  carinena: "Cariñena",
  carignan: "Cariñena",
  monastrell: "Monastrell",
  monastell: "Monastrell",
  mourvedre: "Mourvèdre",
  "mourvèdre": "Mourvèdre",
  mataro: "Mourvèdre",
  "petite sirah": "Petite Sirah",
  "petite syrah": "Petite Sirah",
  graciano: "Graciano",
  mazuelo: "Mazuelo",
  barbera: "Barbera",
};

function normalizeToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/**
 * Split a free-text grape field into canonical varieties.
 * Handles commas, hyphens, "and", and known multi-word names.
 */
export function parseGrapes(grapeField: string | null | undefined): CanonicalGrape[] {
  if (!grapeField?.trim()) return [];

  const text = grapeField
    .replace(/\band\b/gi, ",")
    .replace(/\//g, ",")
    .replace(/[–—]/g, "-");

  // Prefer splitting on commas first; then hyphens for blends without commas
  const parts = text.includes(",")
    ? text.split(",")
    : text.split(/\s*-\s*/);

  const found = new Set<CanonicalGrape>();

  for (const part of parts) {
    const token = normalizeToken(part);
    if (!token) continue;

    // Direct alias
    if (ALIASES[token]) {
      found.add(ALIASES[token]);
      continue;
    }

    // Try multi-word matches inside the token (longest first)
    const keys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
    let matched = false;
    for (const key of keys) {
      if (token === key || token.includes(key)) {
        found.add(ALIASES[key]);
        matched = true;
        // Don't break: "cabernet sauvignon merlot" style rare, but "cabernet, merlot" already split
        if (token === key) break;
      }
    }
    if (matched) continue;

    // Fallback: scan original field chunks for known aliases
  }

  // Also scan whole string for aliases in case of unusual separators
  if (found.size === 0) {
    const whole = normalizeToken(grapeField);
    const keys = Object.keys(ALIASES).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (whole.includes(key)) found.add(ALIASES[key]);
    }
  }

  return [...found];
}

export function wineHasGrape(wine: Wine, grape: string): boolean {
  if (!grape) return true;
  return parseGrapes(wine.grape).includes(grape as CanonicalGrape);
}

/** Unique canonical grapes present in the cellar, sorted by frequency */
export function grapesInCellar(wines: Wine[]): { name: CanonicalGrape; count: number }[] {
  const counts = new Map<CanonicalGrape, number>();
  for (const w of wines) {
    for (const g of parseGrapes(w.grape)) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}
