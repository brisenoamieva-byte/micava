/**
 * Shared bottle taxonomy: wine + spirits in the same cellar/map.
 * Types are free-form strings in storage; this list is the curated UI/scan set.
 */

export const WINE_TYPES = ["Tinto", "Blanco", "Rosado", "Espumoso"] as const;

export const SPIRIT_TYPES = [
  "Ron",
  "Whisky",
  "Tequila",
  "Mezcal",
  "Gin",
  "Cognac",
  "Otro destilado",
] as const;

export const BOTTLE_TYPES = [...WINE_TYPES, ...SPIRIT_TYPES] as const;

export type WineBottleType = (typeof WINE_TYPES)[number];
export type SpiritBottleType = (typeof SPIRIT_TYPES)[number];
export type BottleType = (typeof BOTTLE_TYPES)[number];

function norm(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function isSpiritType(type: string | null | undefined): boolean {
  const t = norm(type ?? "");
  if (!t) return false;
  if (
    /ron|rum|whisky|whiskey|bourbon|scotch|tequila|mezcal|gin|cognac|brandy|destil|spirit|vodka|raicilla|sotol|aguardiente/.test(
      t
    )
  ) {
    return true;
  }
  return (SPIRIT_TYPES as readonly string[]).some((x) => norm(x) === t);
}

export function isWineType(type: string | null | undefined): boolean {
  const t = norm(type ?? "");
  if (!t) return true;
  if (isSpiritType(t)) return false;
  return (
    /tint|blanc|white|rosa|rosado|rose|espum|spark|cava|champ|prosecco|red|rouge/.test(
      t
    ) || (WINE_TYPES as readonly string[]).some((x) => norm(x) === t)
  );
}

/** Normalize scan/import/type strings into curated bottle types. */
export function normalizeBottleType(raw: string): string {
  const t = norm(raw);
  if (!t) return "Tinto";

  if (
    /espum|spark|cava|champ|prosecco|cremant/.test(t) &&
    !/cognac|brandy/.test(t)
  ) {
    return "Espumoso";
  }
  if (/blanc|white|blanco/.test(t) && !/whisky|whiskey/.test(t)) {
    return "Blanco";
  }
  if (/rosa|rosado|rose|pink/.test(t)) return "Rosado";
  if (/tint|red|rouge|negro/.test(t) && !/destil|spirit/.test(t)) {
    return "Tinto";
  }

  if (/ron|rum/.test(t)) return "Ron";
  if (/whisky|whiskey|bourbon|scotch|rye/.test(t)) return "Whisky";
  if (/tequila/.test(t)) return "Tequila";
  if (/mezcal|raicilla|sotol/.test(t)) return "Mezcal";
  if (/\bgin\b|ginebra/.test(t)) return "Gin";
  if (/cognac|brandy|armagnac/.test(t)) return "Cognac";
  if (/destil|spirit|vodka|aguardiente|licor|liqueur/.test(t)) {
    return "Otro destilado";
  }

  const exact = BOTTLE_TYPES.find((x) => norm(x) === t);
  return exact ?? (raw.trim() || "Tinto");
}
