/**
 * Single source of truth for wine-producing countries used in:
 * add/edit forms, flags, label scan normalization, and AI prompts.
 * Canonical `name` is Spanish (DB / filters); `nameEn` is for English UI.
 */

export type WineCountry = {
  /** Canonical Spanish name stored in the DB. */
  name: string;
  /** English display name. */
  nameEn: string;
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
    nameEn: "Germany",
    code: "DE",
    iso: "de",
    emoji: "🇩🇪",
    aliases: ["germany", "deutschland", "de"],
  },
  {
    name: "Argentina",
    nameEn: "Argentina",
    code: "AR",
    iso: "ar",
    emoji: "🇦🇷",
    aliases: ["ar"],
  },
  {
    name: "Armenia",
    nameEn: "Armenia",
    code: "AM",
    iso: "am",
    emoji: "🇦🇲",
    aliases: ["am"],
  },
  {
    name: "Australia",
    nameEn: "Australia",
    code: "AU",
    iso: "au",
    emoji: "🇦🇺",
    aliases: ["au"],
  },
  {
    name: "Austria",
    nameEn: "Austria",
    code: "AT",
    iso: "at",
    emoji: "🇦🇹",
    aliases: ["at", "österreich", "osterreich"],
  },
  {
    name: "Brasil",
    nameEn: "Brazil",
    code: "BR",
    iso: "br",
    emoji: "🇧🇷",
    aliases: ["brazil", "br"],
  },
  {
    name: "Bulgaria",
    nameEn: "Bulgaria",
    code: "BG",
    iso: "bg",
    emoji: "🇧🇬",
    aliases: ["bg"],
  },
  {
    name: "Canadá",
    nameEn: "Canada",
    code: "CA",
    iso: "ca",
    emoji: "🇨🇦",
    aliases: ["canada", "ca"],
  },
  {
    name: "Chile",
    nameEn: "Chile",
    code: "CL",
    iso: "cl",
    emoji: "🇨🇱",
    aliases: ["cl"],
  },
  {
    name: "China",
    nameEn: "China",
    code: "CN",
    iso: "cn",
    emoji: "🇨🇳",
    aliases: ["cn", "prc"],
  },
  {
    name: "Chipre",
    nameEn: "Cyprus",
    code: "CY",
    iso: "cy",
    emoji: "🇨🇾",
    aliases: ["cyprus", "cy"],
  },
  {
    name: "Croacia",
    nameEn: "Croatia",
    code: "HR",
    iso: "hr",
    emoji: "🇭🇷",
    aliases: ["croatia", "hrvatska", "hr"],
  },
  {
    name: "Eslovenia",
    nameEn: "Slovenia",
    code: "SI",
    iso: "si",
    emoji: "🇸🇮",
    aliases: ["slovenia", "slovenija", "si"],
  },
  {
    name: "España",
    nameEn: "Spain",
    code: "ES",
    iso: "es",
    emoji: "🇪🇸",
    aliases: ["spain", "espana", "es"],
  },
  {
    name: "Francia",
    nameEn: "France",
    code: "FR",
    iso: "fr",
    emoji: "🇫🇷",
    aliases: ["france", "fr"],
  },
  {
    name: "Georgia",
    nameEn: "Georgia",
    code: "GE",
    iso: "ge",
    emoji: "🇬🇪",
    aliases: ["ge", "sakartvelo"],
  },
  {
    name: "Grecia",
    nameEn: "Greece",
    code: "GR",
    iso: "gr",
    emoji: "🇬🇷",
    aliases: ["greece", "gr", "hellas"],
  },
  {
    name: "Hungría",
    nameEn: "Hungary",
    code: "HU",
    iso: "hu",
    emoji: "🇭🇺",
    aliases: ["hungary", "hu", "magyarorszag", "magyarország"],
  },
  {
    name: "India",
    nameEn: "India",
    code: "IN",
    iso: "in",
    emoji: "🇮🇳",
    aliases: ["in"],
  },
  {
    name: "Israel",
    nameEn: "Israel",
    code: "IL",
    iso: "il",
    emoji: "🇮🇱",
    aliases: ["il"],
  },
  {
    name: "Italia",
    nameEn: "Italy",
    code: "IT",
    iso: "it",
    emoji: "🇮🇹",
    aliases: ["italy", "it"],
  },
  {
    name: "Japón",
    nameEn: "Japan",
    code: "JP",
    iso: "jp",
    emoji: "🇯🇵",
    aliases: ["japan", "jp", "nippon"],
  },
  {
    name: "Líbano",
    nameEn: "Lebanon",
    code: "LB",
    iso: "lb",
    emoji: "🇱🇧",
    aliases: ["lebanon", "lb", "liban"],
  },
  {
    name: "Luxemburgo",
    nameEn: "Luxembourg",
    code: "LU",
    iso: "lu",
    emoji: "🇱🇺",
    aliases: ["luxembourg", "lu"],
  },
  {
    name: "Marruecos",
    nameEn: "Morocco",
    code: "MA",
    iso: "ma",
    emoji: "🇲🇦",
    aliases: ["morocco", "ma", "maroc"],
  },
  {
    name: "México",
    nameEn: "Mexico",
    code: "MX",
    iso: "mx",
    emoji: "🇲🇽",
    aliases: ["mexico", "mx", "mex"],
  },
  {
    name: "Moldavia",
    nameEn: "Moldova",
    code: "MD",
    iso: "md",
    emoji: "🇲🇩",
    aliases: ["moldova", "md", "republic of moldova", "república de moldavia"],
  },
  {
    name: "Montenegro",
    nameEn: "Montenegro",
    code: "ME",
    iso: "me",
    emoji: "🇲🇪",
    aliases: ["me", "crna gora"],
  },
  {
    name: "Nueva Zelanda",
    nameEn: "New Zealand",
    code: "NZ",
    iso: "nz",
    emoji: "🇳🇿",
    aliases: ["new zealand", "nz", "aotearoa"],
  },
  {
    name: "Perú",
    nameEn: "Peru",
    code: "PE",
    iso: "pe",
    emoji: "🇵🇪",
    aliases: ["peru", "pe"],
  },
  {
    name: "Portugal",
    nameEn: "Portugal",
    code: "PT",
    iso: "pt",
    emoji: "🇵🇹",
    aliases: ["pt"],
  },
  {
    name: "Reino Unido",
    nameEn: "United Kingdom",
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
    nameEn: "Czechia",
    code: "CZ",
    iso: "cz",
    emoji: "🇨🇿",
    aliases: ["czech republic", "czechia", "chequia", "cz", "czech"],
  },
  {
    name: "Rumania",
    nameEn: "Romania",
    code: "RO",
    iso: "ro",
    emoji: "🇷🇴",
    aliases: ["romania", "ro", "românia"],
  },
  {
    name: "Serbia",
    nameEn: "Serbia",
    code: "RS",
    iso: "rs",
    emoji: "🇷🇸",
    aliases: ["rs", "srbija"],
  },
  {
    name: "Sudáfrica",
    nameEn: "South Africa",
    code: "ZA",
    iso: "za",
    emoji: "🇿🇦",
    aliases: ["south africa", "za", "rsa", "sudafrica"],
  },
  {
    name: "Suiza",
    nameEn: "Switzerland",
    code: "CH",
    iso: "ch",
    emoji: "🇨🇭",
    aliases: ["switzerland", "ch", "schweiz", "suisse", "svizzera"],
  },
  {
    name: "Turquía",
    nameEn: "Turkey",
    code: "TR",
    iso: "tr",
    emoji: "🇹🇷",
    aliases: ["turkey", "turkiye", "türkiye", "tr"],
  },
  {
    /** Kept as "USA" to match existing cellar / seed data. */
    name: "USA",
    nameEn: "USA",
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
    nameEn: "Uruguay",
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

const COUNTRY_BY_NAME: Record<string, WineCountry> = Object.fromEntries(
  WINE_COUNTRIES.map((c) => [c.name, c])
);

/**
 * Display label for a canonical (usually Spanish) country name.
 * Unknown values are returned as-is; "Otro" → "Other" in English.
 */
export function countryDisplayName(
  canonical: string,
  locale: string = "es"
): string {
  const trimmed = canonical.trim();
  if (!trimmed) return trimmed;
  if (trimmed === "Otro" || trimmed.toLowerCase() === "other") {
    return locale === "en" ? "Other" : "Otro";
  }
  const entry = COUNTRY_BY_NAME[trimmed];
  if (!entry) return trimmed;
  return locale === "en" ? entry.nameEn : entry.name;
}

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
    map[foldKey(c.nameEn)] = c.name;
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
