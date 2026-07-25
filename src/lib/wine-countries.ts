/**
 * Single source of truth for wine-producing countries used in:
 * add/edit forms, flags, label scan normalization, and AI prompts.
 * Display names are Spanish (app locale).
 */

export type WineCountry = {
  name: string;
  /** ISO 3166-1 alpha-2 (uppercase) for compact UI */
  code: string;
  /** ISO 3166-1 alpha-2 (lowercase) for flagcdn */
  iso: string;
  emoji: string;
  /** Extra aliases (English, local endonyms, ISO, common misspellings). Folded at lookup. */
  aliases?: readonly string[];
};

/** Major wine-producing countries (OIV-relevant + common cellar finds). */
export const WINE_COUNTRIES: readonly WineCountry[] = [
  {
    name: "Alemania",
    code: "DE",
    iso: "de",
    emoji: "🇩🇪",
    aliases: ["germany", "deutschland", "de"],
  },
  {
    name: "Argentina",
    code: "AR",
    iso: "ar",
    emoji: "🇦🇷",
    aliases: ["ar"],
  },
  {
    name: "Armenia",
    code: "AM",
    iso: "am",
    emoji: "🇦🇲",
    aliases: ["am"],
  },
  {
    name: "Australia",
    code: "AU",
    iso: "au",
    emoji: "🇦🇺",
    aliases: ["au"],
  },
  {
    name: "Austria",
    code: "AT",
    iso: "at",
    emoji: "🇦🇹",
    aliases: ["at", "österreich", "osterreich"],
  },
  {
    name: "Brasil",
    code: "BR",
    iso: "br",
    emoji: "🇧🇷",
    aliases: ["brazil", "br"],
  },
  {
    name: "Bulgaria",
    code: "BG",
    iso: "bg",
    emoji: "🇧🇬",
    aliases: ["bg"],
  },
  {
    name: "Canadá",
    code: "CA",
    iso: "ca",
    emoji: "🇨🇦",
    aliases: ["canada", "ca"],
  },
  {
    name: "Chile",
    code: "CL",
    iso: "cl",
    emoji: "🇨🇱",
    aliases: ["cl"],
  },
  {
    name: "China",
    code: "CN",
    iso: "cn",
    emoji: "🇨🇳",
    aliases: ["cn", "prc"],
  },
  {
    name: "Chipre",
    code: "CY",
    iso: "cy",
    emoji: "🇨🇾",
    aliases: ["cyprus", "cy"],
  },
  {
    name: "Croacia",
    code: "HR",
    iso: "hr",
    emoji: "🇭🇷",
    aliases: ["croatia", "hrvatska", "hr"],
  },
  {
    name: "Eslovenia",
    code: "SI",
    iso: "si",
    emoji: "🇸🇮",
    aliases: ["slovenia", "slovenija", "si"],
  },
  {
    name: "España",
    code: "ES",
    iso: "es",
    emoji: "🇪🇸",
    aliases: ["spain", "espana", "es"],
  },
  {
    name: "Francia",
    code: "FR",
    iso: "fr",
    emoji: "🇫🇷",
    aliases: ["france", "fr"],
  },
  {
    name: "Georgia",
    code: "GE",
    iso: "ge",
    emoji: "🇬🇪",
    aliases: ["ge", "sakartvelo"],
  },
  {
    name: "Grecia",
    code: "GR",
    iso: "gr",
    emoji: "🇬🇷",
    aliases: ["greece", "gr", "hellas"],
  },
  {
    name: "Hungría",
    code: "HU",
    iso: "hu",
    emoji: "🇭🇺",
    aliases: ["hungary", "hu", "magyarorszag", "magyarország"],
  },
  {
    name: "India",
    code: "IN",
    iso: "in",
    emoji: "🇮🇳",
    aliases: ["in"],
  },
  {
    name: "Israel",
    code: "IL",
    iso: "il",
    emoji: "🇮🇱",
    aliases: ["il"],
  },
  {
    name: "Italia",
    code: "IT",
    iso: "it",
    emoji: "🇮🇹",
    aliases: ["italy", "it"],
  },
  {
    name: "Japón",
    code: "JP",
    iso: "jp",
    emoji: "🇯🇵",
    aliases: ["japan", "jp", "nippon"],
  },
  {
    name: "Líbano",
    code: "LB",
    iso: "lb",
    emoji: "🇱🇧",
    aliases: ["lebanon", "lb", "liban"],
  },
  {
    name: "Luxemburgo",
    code: "LU",
    iso: "lu",
    emoji: "🇱🇺",
    aliases: ["luxembourg", "lu"],
  },
  {
    name: "Marruecos",
    code: "MA",
    iso: "ma",
    emoji: "🇲🇦",
    aliases: ["morocco", "ma", "maroc"],
  },
  {
    name: "México",
    code: "MX",
    iso: "mx",
    emoji: "🇲🇽",
    aliases: ["mexico", "mx", "mex"],
  },
  {
    name: "Moldavia",
    code: "MD",
    iso: "md",
    emoji: "🇲🇩",
    aliases: ["moldova", "md", "republic of moldova", "república de moldavia"],
  },
  {
    name: "Montenegro",
    code: "ME",
    iso: "me",
    emoji: "🇲🇪",
    aliases: ["me", "crna gora"],
  },
  {
    name: "Nueva Zelanda",
    code: "NZ",
    iso: "nz",
    emoji: "🇳🇿",
    aliases: ["new zealand", "nz", "aotearoa"],
  },
  {
    name: "Perú",
    code: "PE",
    iso: "pe",
    emoji: "🇵🇪",
    aliases: ["peru", "pe"],
  },
  {
    name: "Portugal",
    code: "PT",
    iso: "pt",
    emoji: "🇵🇹",
    aliases: ["pt"],
  },
  {
    name: "Reino Unido",
    code: "GB",
    iso: "gb",
    emoji: "🇬🇧",
    aliases: [
      "uk",
      "gb",
      "united kingdom",
      "england",
      "inglaterra",
      "great britain",
      "wales",
      "scotland",
      "gales",
      "escocia",
    ],
  },
  {
    name: "República Checa",
    code: "CZ",
    iso: "cz",
    emoji: "🇨🇿",
    aliases: ["czech republic", "czechia", "chequia", "cz", "czech"],
  },
  {
    name: "Rumania",
    code: "RO",
    iso: "ro",
    emoji: "🇷🇴",
    aliases: ["romania", "ro", "românia"],
  },
  {
    name: "Serbia",
    code: "RS",
    iso: "rs",
    emoji: "🇷🇸",
    aliases: ["rs", "srbija"],
  },
  {
    name: "Sudáfrica",
    code: "ZA",
    iso: "za",
    emoji: "🇿🇦",
    aliases: ["south africa", "za", "rsa", "sudafrica"],
  },
  {
    name: "Suiza",
    code: "CH",
    iso: "ch",
    emoji: "🇨🇭",
    aliases: ["switzerland", "ch", "schweiz", "suisse", "svizzera"],
  },
  {
    name: "Turquía",
    code: "TR",
    iso: "tr",
    emoji: "🇹🇷",
    aliases: ["turkey", "turkiye", "türkiye", "tr"],
  },
  {
    /** Kept as "USA" to match existing cellar / seed data. */
    name: "USA",
    code: "US",
    iso: "us",
    emoji: "🇺🇸",
    aliases: [
      "us",
      "united states",
      "united states of america",
      "estados unidos",
      "eeuu",
      "ee.uu.",
      "ee. uu.",
      "u.s.",
      "u.s.a.",
    ],
  },
  {
    name: "Uruguay",
    code: "UY",
    iso: "uy",
    emoji: "🇺🇾",
    aliases: ["uy"],
  },
] as const;

/** Canonical Spanish names (alphabetical as defined above). */
export const WINE_COUNTRY_NAMES: readonly string[] = WINE_COUNTRIES.map(
  (c) => c.name
);

export const countryCode: Record<string, string> = Object.fromEntries(
  WINE_COUNTRIES.map((c) => [c.name, c.code])
);

export const countryIso: Record<string, string> = Object.fromEntries(
  WINE_COUNTRIES.map((c) => [c.name, c.iso])
);

export const countryFlagEmoji: Record<string, string> = Object.fromEntries(
  WINE_COUNTRIES.map((c) => [c.name, c.emoji])
);

function foldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Map folded alias / name → canonical Spanish name. */
const COUNTRY_ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const c of WINE_COUNTRIES) {
    map[foldKey(c.name)] = c.name;
    map[foldKey(c.code)] = c.name;
    map[foldKey(c.iso)] = c.name;
    for (const a of c.aliases ?? []) {
      map[foldKey(a)] = c.name;
    }
  }
  return map;
})();

/**
 * Normalize free-text / AI country to a known wine country, or "Otro".
 * Accepts Spanish names, English, endonyms (e.g. Hrvatska), and ISO codes.
 */
export function normalizeCountry(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Otro";
  const folded = foldKey(trimmed);
  if (folded === "otro" || folded === "other" || folded === "unknown") {
    return "Otro";
  }
  return COUNTRY_ALIAS_MAP[folded] ?? "Otro";
}

/** Comma-separated list for AI system prompts. */
export function wineCountriesForPrompt(): string {
  return `${WINE_COUNTRY_NAMES.join(", ")} u Otro`;
}
