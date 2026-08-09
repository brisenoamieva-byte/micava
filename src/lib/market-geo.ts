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
  /** Cuisine guidance for food pairings in this market. */
  pairingCuisineHint: string;
};

type MarketProfile = {
  currency: string;
  marketLabel: string;
  retailersHint: string;
  searchPriceHint: string;
  pairingCuisineHint: string;
};

const PROFILES: Record<string, MarketProfile> = {
  MX: {
    currency: "MXN",
    marketLabel: "México",
    retailersHint: "La Europea, Vinoteca, Amazon MX, Liverpool, Sam's Club México",
    searchPriceHint: "precio México MXN",
    pairingCuisineHint:
      "Comida realista de mesa en México: asados y cortes a la parrilla, pollo rostizado, pasta, mariscos, quesos, guisos cotidianos, cena de restaurante o casa. NO te bases solo en platillos típicos/folclóricos (birria, mole, carnitas, antojitos de feria); a lo sumo uno si encaja de verdad con la botella.",
  },
  US: {
    currency: "USD",
    marketLabel: "United States",
    retailersHint: "Wine.com, Total Wine, Vivino US, Costco, local wine shops",
    searchPriceHint: "retail price USD",
    pairingCuisineHint:
      "Realistic US table food someone would order or cook: steak, roast chicken, pasta, seafood, burgers, cheese boards — not a postcard of regional specialties. Do NOT suggest Mexico-specific dishes (birria, mole, carnitas) unless the wine itself is Mexican.",
  },
  CA: {
    currency: "CAD",
    marketLabel: "Canada",
    retailersHint: "LCBO, SAQ, BCL, Vivino Canada",
    searchPriceHint: "retail price CAD",
    pairingCuisineHint:
      "Realistic Canadian / North American everyday table food (grilled meats, roast, pasta, seafood, cheese). Avoid Mexico-only dishes unless the wine is Mexican. Don't fill the list with only folkloric specialties.",
  },
  GB: {
    currency: "GBP",
    marketLabel: "United Kingdom",
    retailersHint: "Majestic, Waitrose, Tesco, Vivino UK",
    searchPriceHint: "retail price GBP UK",
    pairingCuisineHint:
      "Realistic British everyday table food (roast, grilled meats, pasta, seafood, cheese boards, pub classics). Avoid Mexico-only dishes. Don't default to only touristy specialties.",
  },
  ES: {
    currency: "EUR",
    marketLabel: "España",
    retailersHint: "El Corte Inglés, Vinissimus, Vivino España, Bodeboca",
    searchPriceHint: "precio España EUR",
    pairingCuisineHint:
      "Comida realista de mesa en España: asados, pescado, pasta, arroces, quesos, carne a la parrilla — no solo tapas/jamón de postal. Evita platillos solo-mexicanos salvo que el vino sea mexicano.",
  },
  FR: {
    currency: "EUR",
    marketLabel: "France",
    retailersHint: "Nicolas, Cavea, Vivino France, wine shops",
    searchPriceHint: "prix France EUR",
    pairingCuisineHint:
      "Realistic French / European everyday table food (roast, grilled meats, pasta, cheese, seafood). Avoid Mexico-only dishes. Don't fill with only postcard specialties.",
  },
  IT: {
    currency: "EUR",
    marketLabel: "Italia",
    retailersHint: "Tannico, Vivino Italia, enoteche",
    searchPriceHint: "prezzo Italia EUR",
    pairingCuisineHint:
      "Realistic Italian everyday table food (pasta, grilled meats, risotto, antipasti, cheese). Avoid Mexico-only dishes.",
  },
  DE: {
    currency: "EUR",
    marketLabel: "Germany",
    retailersHint: "Hawesko, Vivino Germany, wine shops",
    searchPriceHint: "Preis Deutschland EUR",
    pairingCuisineHint:
      "Realistic German / Central European everyday table food (roast, grilled meats, pasta, cheese). Avoid Mexico-only dishes.",
  },
  AR: {
    currency: "ARS",
    marketLabel: "Argentina",
    retailersHint: "Vivino Argentina, tiendas de vinos locales",
    searchPriceHint: "precio Argentina ARS",
    pairingCuisineHint:
      "Comida realista de mesa en Argentina: asado/cortes, pasta, pollo, quesos — no solo empanadas/provoleta de postal. Evita platillos solo-mexicanos.",
  },
  CL: {
    currency: "CLP",
    marketLabel: "Chile",
    retailersHint: "Vivino Chile, tiendas de vinos locales",
    searchPriceHint: "precio Chile CLP",
    pairingCuisineHint:
      "Comida realista de mesa en Chile: asados, pescados/mariscos, pasta, pollo. Evita platillos solo-mexicanos. No bases la lista solo en tipismos.",
  },
  CO: {
    currency: "COP",
    marketLabel: "Colombia",
    retailersHint: "Vivino Colombia, tiendas de vinos locales",
    searchPriceHint: "precio Colombia COP",
    pairingCuisineHint:
      "Comida realista de mesa en Colombia: carne a la parrilla, pollo, pasta, pescado, quesos. Evita platillos solo-mexicanos. No llenes con tipismos.",
  },
  BR: {
    currency: "BRL",
    marketLabel: "Brasil",
    retailersHint: "Vivino Brasil, Wine.com.br, lojas locais",
    searchPriceHint: "preço Brasil BRL",
    pairingCuisineHint:
      "Realistic Brazilian everyday table food (grilled meats, pasta, seafood, cheese). Avoid Mexico-only dishes.",
  },
  AU: {
    currency: "AUD",
    marketLabel: "Australia",
    retailersHint: "Dan Murphy's, Vivino Australia, wine shops",
    searchPriceHint: "retail price AUD",
    pairingCuisineHint:
      "Realistic Australian everyday table food (BBQ, roast lamb, seafood, pasta, cheese). Avoid Mexico-only dishes.",
  },
  NZ: {
    currency: "NZD",
    marketLabel: "New Zealand",
    retailersHint: "Vivino NZ, local wine shops",
    searchPriceHint: "retail price NZD",
    pairingCuisineHint:
      "Realistic NZ everyday table food (lamb, seafood, pasta, cheese). Avoid Mexico-only dishes.",
  },
  JP: {
    currency: "JPY",
    marketLabel: "Japan",
    retailersHint: "Vivino Japan, local wine retailers",
    searchPriceHint: "retail price JPY Japan",
    pairingCuisineHint:
      "Realistic Japanese / local dishes that pair with wine (yakitori, grilled fish, pasta, cheese & nuts) — not only tourist staples. Avoid Mexico-only dishes.",
  },
};

const FALLBACK: MarketProfile = {
  currency: "USD",
  marketLabel: "international",
  retailersHint: "Vivino, major online wine retailers in that country",
  searchPriceHint: "retail price wine bottle",
  pairingCuisineHint:
    "Realistic everyday table food appropriate to the user's country (grilled meats, roast, pasta, seafood, cheese). Do NOT default to Mexico-specific dishes unless the user is in Mexico or the wine is Mexican. Don't fill the list with only folkloric specialties.",
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
    pairingCuisineHint: profile.pairingCuisineHint,
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
