/**
 * Resolve which retail market to use for wine price estimates.
 * Prefer explicit client country → Vercel geo → Accept-Language region → MX default.
 */

export type MarketGeo = {
  /** ISO 3166-1 alpha-2, uppercase. */
  countryCode: string;
  isMexico: boolean;
  /** Local currency code for search / conversion hints. */
  currency: string;
  /** Short market label for prompts. */
  marketLabel: string;
  /** Retailer / marketplace hints for $web_search. */
  retailersHint: string;
  /** Phrase appended to search queries. */
  searchPriceHint: string;
};

type MarketProfile = {
  currency: string;
  marketLabel: string;
  retailersHint: string;
  searchPriceHint: string;
};

const PROFILES: Record<string, MarketProfile> = {
  MX: {
    currency: "MXN",
    marketLabel: "México",
    retailersHint: "La Europea, Vinoteca, Amazon MX, Liverpool, Sam's Club México",
    searchPriceHint: "precio México MXN",
  },
  US: {
    currency: "USD",
    marketLabel: "United States",
    retailersHint: "Wine.com, Total Wine, Vivino US, Costco, local wine shops",
    searchPriceHint: "retail price USD",
  },
  CA: {
    currency: "CAD",
    marketLabel: "Canada",
    retailersHint: "LCBO, SAQ, BCL, Vivino Canada",
    searchPriceHint: "retail price CAD",
  },
  GB: {
    currency: "GBP",
    marketLabel: "United Kingdom",
    retailersHint: "Majestic, Waitrose, Tesco, Vivino UK",
    searchPriceHint: "retail price GBP UK",
  },
  ES: {
    currency: "EUR",
    marketLabel: "España",
    retailersHint: "El Corte Inglés, Vinissimus, Vivino España, Bodeboca",
    searchPriceHint: "precio España EUR",
  },
  FR: {
    currency: "EUR",
    marketLabel: "France",
    retailersHint: "Nicolas, Cavea, Vivino France, wine shops",
    searchPriceHint: "prix France EUR",
  },
  IT: {
    currency: "EUR",
    marketLabel: "Italia",
    retailersHint: "Tannico, Vivino Italia, enoteche",
    searchPriceHint: "prezzo Italia EUR",
  },
  DE: {
    currency: "EUR",
    marketLabel: "Germany",
    retailersHint: "Hawesko, Vivino Germany, wine shops",
    searchPriceHint: "Preis Deutschland EUR",
  },
  AR: {
    currency: "ARS",
    marketLabel: "Argentina",
    retailersHint: "Vivino Argentina, tiendas de vinos locales",
    searchPriceHint: "precio Argentina ARS",
  },
  CL: {
    currency: "CLP",
    marketLabel: "Chile",
    retailersHint: "Vivino Chile, tiendas de vinos locales",
    searchPriceHint: "precio Chile CLP",
  },
  CO: {
    currency: "COP",
    marketLabel: "Colombia",
    retailersHint: "Vivino Colombia, tiendas de vinos locales",
    searchPriceHint: "precio Colombia COP",
  },
  BR: {
    currency: "BRL",
    marketLabel: "Brasil",
    retailersHint: "Vivino Brasil, Wine.com.br, lojas locais",
    searchPriceHint: "preço Brasil BRL",
  },
  AU: {
    currency: "AUD",
    marketLabel: "Australia",
    retailersHint: "Dan Murphy's, Vivino Australia, wine shops",
    searchPriceHint: "retail price AUD",
  },
  NZ: {
    currency: "NZD",
    marketLabel: "New Zealand",
    retailersHint: "Vivino NZ, local wine shops",
    searchPriceHint: "retail price NZD",
  },
  JP: {
    currency: "JPY",
    marketLabel: "Japan",
    retailersHint: "Vivino Japan, local wine retailers",
    searchPriceHint: "retail price JPY Japan",
  },
};

const FALLBACK: MarketProfile = {
  currency: "USD",
  marketLabel: "international",
  retailersHint: "Vivino, major online wine retailers in that country",
  searchPriceHint: "retail price wine bottle",
};

function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  // UK → GB (ISO)
  if (code === "UK") return "GB";
  return code;
}

/** Parse region from Accept-Language / navigator.language (e.g. es-MX → MX). */
export function countryFromLanguageTag(
  tag: string | null | undefined
): string | null {
  if (!tag) return null;
  const primary = tag.split(",")[0]?.trim() ?? "";
  const m = primary.match(/^[a-z]{2,3}[-_]([a-z]{2})\b/i);
  return normalizeCountryCode(m?.[1] ?? null);
}

function toMarketGeo(countryCode: string): MarketGeo {
  const code = normalizeCountryCode(countryCode) || "MX";
  const profile = PROFILES[code] ?? {
    ...FALLBACK,
    marketLabel: code,
    searchPriceHint: `retail price ${code}`,
  };
  return {
    countryCode: code,
    isMexico: code === "MX",
    currency: profile.currency,
    marketLabel: profile.marketLabel,
    retailersHint: profile.retailersHint,
    searchPriceHint: profile.searchPriceHint,
  };
}

export type ResolveMarketGeoInput = {
  /** Explicit ISO country from client body. */
  countryCode?: string | null;
  /** Vercel `x-vercel-ip-country`. */
  vercelCountry?: string | null;
  /** Request Accept-Language header. */
  acceptLanguage?: string | null;
  /** UI locale (es/en) — weak fallback only. */
  locale?: string | null;
};

/**
 * Pick retail market for price estimates.
 * Explicit client country wins; then edge geo; then language region; else MX.
 */
export function resolveMarketGeo(input: ResolveMarketGeoInput): MarketGeo {
  const fromBody = normalizeCountryCode(input.countryCode);
  if (fromBody) return toMarketGeo(fromBody);

  const fromVercel = normalizeCountryCode(input.vercelCountry);
  if (fromVercel) return toMarketGeo(fromVercel);

  const fromLang = countryFromLanguageTag(input.acceptLanguage);
  if (fromLang) return toMarketGeo(fromLang);

  // Product defaults to México / MXN storage; en locale alone is not enough to leave MX.
  return toMarketGeo("MX");
}

/** Build market geo from a Fetch Request + optional body country. */
export function resolveMarketGeoFromRequest(
  request: Request,
  bodyCountryCode?: string | null
): MarketGeo {
  return resolveMarketGeo({
    countryCode: bodyCountryCode,
    vercelCountry: request.headers.get("x-vercel-ip-country"),
    acceptLanguage: request.headers.get("accept-language"),
  });
}

/** Client hint from navigator.language region (e.g. es-MX → MX). */
export function clientCountryCodeHint(): string | null {
  if (typeof navigator === "undefined") return null;
  return (
    countryFromLanguageTag(navigator.language) ||
    countryFromLanguageTag(navigator.languages?.[0])
  );
}
