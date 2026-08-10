/**
 * Geo-aware retail price lookup via Kimi $web_search.
 * Contar historia path stores MXN (priceMxn). Verify-price path keeps
 * original currency (amount + ISO code) without forcing MXN conversion.
 */

import { extractJsonObject } from "@/lib/scan-label";
import { kimiChatWithWebSearch } from "@/lib/kimi-web-search";
import type { KimiTokenUsage } from "@/lib/kimi-usage";
import { addKimiUsage } from "@/lib/kimi-usage";
import type { MarketGeo } from "@/lib/market-geo";

const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
/**
 * Tool rounds for price lookup.
 * Each $web_search consumes a round; we need ≥ searches + 1 for the final JSON.
 * (Previously 2: a second search exhausted the loop and dropped priceMxn entirely.)
 */
export const PRICE_RESEARCH_MAX_ROUNDS = 4;

/** Rough FX → MXN when the model returns priceLocal but forgets priceMxn. */
const FX_TO_MXN: Record<string, number> = {
  MXN: 1,
  USD: 17,
  EUR: 18.5,
  GBP: 22,
  CAD: 12.5,
  AUD: 11,
  NZD: 10,
  JPY: 0.11,
  ARS: 0.017,
  CLP: 0.018,
  COP: 0.0042,
  BRL: 3.1,
};

export type WinePriceIdentity = {
  name: string;
  winery?: string;
  country?: string;
  region?: string;
  vintage?: number | null;
  type?: string;
  grape?: string;
  /** Crianza / designation (Reserva, Joven, 12 meses…) — critical for SKU price. */
  aging?: string;
};

export type WinePriceResearchResult = {
  /** Typical retail bottle price in MXN (integer), ready for kimiPrice. */
  priceMxn: number | null;
  /** Local currency amount before conversion (if known). */
  priceLocal: number | null;
  currency: string | null;
  notes: string | null;
  usage: KimiTokenUsage | null;
  /** Non-null when lookup failed or returned no usable price. */
  error: string | null;
};

export type VerifiedWinePrice = {
  amount: number | null;
  currency: string | null;
  source: "local" | "international" | null;
  confidence: string | null;
  notes: string | null;
  usage: KimiTokenUsage | null;
  error: string | null;
};

/** International / Wine-Searcher style market when local retail has no hit. */
export const INTERNATIONAL_PRICE_MARKET: MarketGeo = {
  countryCode: "XX",
  isMexico: false,
  currency: "USD",
  marketLabel: "international",
  retailersHint:
    "Wine-Searcher, Vivino, wine.com, major EU/US/UK retailers, producer shop",
  searchPriceHint: "retail price Wine-Searcher Vivino bottle",
  pairingCuisineHint: "",
};

function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function clampPriceMxn(value: number | null): number | null {
  if (value == null) return null;
  const n = Math.round(value);
  if (n <= 0 || n > 1_000_000) return null;
  return n;
}

function clampRetailAmount(value: number | null): number | null {
  if (value == null) return null;
  const n = Math.round(value);
  if (n <= 0 || n > 1_000_000) return null;
  return n;
}

function normalizeCurrency(raw: unknown): string | null {
  const currency = asString(raw).toUpperCase();
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function convertLocalToMxn(
  priceLocal: number | null,
  currency: string | null
): number | null {
  if (priceLocal == null || priceLocal <= 0 || !currency) return null;
  const rate = FX_TO_MXN[currency];
  if (rate == null) return null;
  return clampPriceMxn(priceLocal * rate);
}

export function buildWinePriceSearchQuery(
  wine: WinePriceIdentity,
  market: MarketGeo
): string {
  return [
    wine.name,
    wine.winery,
    wine.aging,
    wine.grape,
    wine.vintage != null ? String(wine.vintage) : "",
    wine.region,
    market.searchPriceHint,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildPriceSystem(market: MarketGeo): string {
  const mxRule = market.isMexico
    ? `- priceMxn: entero MXN de menudeo típico / promedio razonable actual o reciente en México (no el mínimo de oferta rara).`
    : `- Busca precio de menudeo típico / promedio en ${market.marketLabel} (${market.currency}).
- priceLocal: monto en ${market.currency} (entero redondeado).
- priceMxn: convierte priceLocal a MXN con tipo de cambio aproximado reciente; DEBE ser entero MXN.
- Si solo encuentras USD/EUR u otra moneda, conviértelos a MXN en priceMxn y refleja la moneda original en currency/priceLocal cuando puedas.`;

  return `Eres un investigador de precios de vino para Cavatale.
Debes USAR la búsqueda web ($web_search) para estimar el precio de menudeo típico de ESTA botella.
Responde SOLO con JSON válido (sin markdown) con EXACTAMENTE:
priceMxn, priceLocal, currency, confidence, notes.

Mercado objetivo: ${market.marketLabel} (${market.countryCode}), moneda local ${market.currency}.
Tiendas / fuentes preferidas: ${market.retailersHint}.
También puedes usar Vivino u otros catálogos solo como fuente de precio (no escribas texto de marketing).

Reglas:
${mxRule}
- currency: código ISO de la moneda local usada en priceLocal (ej. MXN, USD, EUR), o null.
- Prefiere el precio típico/promedio de menudeo del mercado del usuario, no el outlier más barato.
- IDENTIDAD ESTRICTA: el precio debe ser de ESTA línea + crianza/designación + uva + cosecha cuando constan.
  Joven ≠ Crianza ≠ Reserva ≠ Gran Reserva. Misma bodega NO basta.
  Si solo encuentras precio de otra variante/añada/línea de la casa → priceMxn null (no aproximes con el hermano).
- No inventes precios. Prefiere null a inventar.
- Preferible UNA sola búsqueda corta enfocada en precio retail de esta botella/cosecha/crianza (máximo 2).
- Tras la búsqueda, responde de inmediato con el JSON (no dejes priceMxn vacío si hay datos).
- notes: una frase corta sobre fuentes (sin URLs largas). Si convertiste a MXN, menciónalo. Si rechazaste por variante distinta, dilo.`;
}

function buildVerifyPriceSystem(
  market: MarketGeo,
  pass: "local" | "international"
): string {
  const marketBlock =
    pass === "local"
      ? `Mercado LOCAL primero: ${market.marketLabel} (${market.countryCode}).
Tiendas preferidas: ${market.retailersHint}.
Moneda preferida del mercado: ${market.currency}.`
      : `Mercado INTERNACIONAL (fallback): busca el precio de menudeo más fiable a nivel global.
Fuentes: Wine-Searcher, Vivino, wine.com, retailers EU/US/UK, tienda del productor.
Devuelve el precio en la moneda ORIGINAL de la fuente (EUR, USD, GBP, etc.) — NO conviertas a MXN.`;

  return `Eres un verificador de precios de vino para Cavatale (solo precio, sin historia).
Debes USAR $web_search. Responde SOLO con JSON válido (sin markdown):
amount, currency, confidence, notes.

${marketBlock}

Reglas:
- amount: entero redondeado del precio de menudeo típico / promedio razonable (1 botella).
- currency: código ISO 4217 de amount (MXN, USD, EUR, GBP…). OBLIGATORIO si hay amount.
- NO conviertas a otra moneda. Si el anuncio está en EUR, amount en euros y currency "EUR".
- Prefiere precio típico/promedio, no el outlier más barato ni subastas.
- IDENTIDAD ESTRICTA: misma línea + crianza + uva + cosecha cuando constan. Si el hit es otra variante → amount null.
- No inventes. Si no hay dato fiable: amount null, currency null.
- confidence: "high" | "medium" | "low".
- Preferible 1 búsqueda corta (máx 2). Luego responde JSON de inmediato.
- notes: una frase corta sobre la fuente (sin URLs largas).`;
}

function buildPriceUser(wine: WinePriceIdentity, market: MarketGeo): string {
  const query = buildWinePriceSearchQuery(wine, market);
  return `Estima el precio de menudeo típico de esta botella EXACTA para el mercado ${market.marketLabel}:

- name: ${wine.name}
- winery: ${wine.winery || ""}
- country: ${wine.country || ""}
- region: ${wine.region || ""}
- type: ${wine.type || ""}
- grape: ${wine.grape || ""}
- aging / designación: ${wine.aging || ""}
- vintage: ${wine.vintage ?? ""}
- consulta sugerida: ${query}

Usa $web_search (preferible 1 búsqueda). Si el precio público es de otra crianza/línea/uva/añada, devuelve priceMxn null.
JSON con priceMxn rellenado SOLO cuando el match sea de esta variante.`;
}

function buildVerifyPriceUser(
  wine: WinePriceIdentity,
  market: MarketGeo,
  pass: "local" | "international"
): string {
  const query = buildWinePriceSearchQuery(
    wine,
    pass === "international" ? INTERNATIONAL_PRICE_MARKET : market
  );
  return `Verifica SOLO el precio de menudeo típico de esta botella (${pass === "local" ? "mercado local" : "búsqueda internacional"}):

- name: ${wine.name}
- winery: ${wine.winery || ""}
- country: ${wine.country || ""}
- region: ${wine.region || ""}
- type: ${wine.type || ""}
- grape: ${wine.grape || ""}
- aging / designación: ${wine.aging || ""}
- vintage: ${wine.vintage ?? ""}
- consulta sugerida: ${query}

Usa $web_search y devuelve JSON con amount + currency (moneda original, sin convertir).
Si el hit es otra crianza/línea/uva/añada → amount null.`;
}

function emptyResult(
  usage: KimiTokenUsage | null = null,
  error: string | null = null
): WinePriceResearchResult {
  return {
    priceMxn: null,
    priceLocal: null,
    currency: null,
    notes: null,
    usage,
    error,
  };
}

function emptyVerified(
  usage: KimiTokenUsage | null = null,
  error: string | null = null
): VerifiedWinePrice {
  return {
    amount: null,
    currency: null,
    source: null,
    confidence: null,
    notes: null,
    usage,
    error,
  };
}

function parsePricePayload(raw: unknown): Omit<
  WinePriceResearchResult,
  "usage" | "error"
> {
  if (!raw || typeof raw !== "object") {
    return {
      priceMxn: null,
      priceLocal: null,
      currency: null,
      notes: null,
    };
  }
  const o = raw as Record<string, unknown>;
  let priceMxn = clampPriceMxn(
    asOptionalNumber(o.priceMxn ?? o.price_mxn ?? o.price ?? o.kimiPrice)
  );
  const priceLocal = asOptionalNumber(o.priceLocal ?? o.price_local);
  const currency = normalizeCurrency(o.currency);
  const notes = asString(o.notes) || null;
  const localRounded =
    priceLocal != null && priceLocal > 0 ? Math.round(priceLocal) : null;
  const currencyOk = currency;

  // If model filled local price but forgot MXN, convert with rough FX.
  if (priceMxn == null && localRounded != null) {
    priceMxn = convertLocalToMxn(localRounded, currencyOk);
  }
  // Mexico: treat a lone positive priceLocal as MXN when currency missing/MXN.
  if (
    priceMxn == null &&
    localRounded != null &&
    (currencyOk == null || currencyOk === "MXN")
  ) {
    priceMxn = clampPriceMxn(localRounded);
  }

  return {
    priceMxn,
    priceLocal: localRounded,
    currency: currencyOk,
    notes,
  };
}

function parseVerifyPayload(raw: unknown): {
  amount: number | null;
  currency: string | null;
  confidence: string | null;
  notes: string | null;
} {
  if (!raw || typeof raw !== "object") {
    return { amount: null, currency: null, confidence: null, notes: null };
  }
  const o = raw as Record<string, unknown>;
  const currency = normalizeCurrency(o.currency);
  let amount = clampRetailAmount(
    asOptionalNumber(o.amount ?? o.priceLocal ?? o.price_local ?? o.price)
  );
  // Legacy shape from local research helpers.
  if (amount == null) {
    const mxn = clampRetailAmount(asOptionalNumber(o.priceMxn ?? o.price_mxn));
    if (mxn != null && (currency == null || currency === "MXN")) {
      amount = mxn;
    }
  }
  const confidenceRaw = asString(o.confidence).toLowerCase();
  const confidence =
    confidenceRaw === "high" ||
    confidenceRaw === "medium" ||
    confidenceRaw === "low"
      ? confidenceRaw
      : null;
  return {
    amount,
    currency: amount != null ? currency ?? null : null,
    notes: asString(o.notes) || null,
    confidence,
  };
}

async function researchWineRetailPriceOnce(options: {
  apiKey: string;
  wine: WinePriceIdentity;
  market: MarketGeo;
  maxRounds: number;
}): Promise<WinePriceResearchResult> {
  const { apiKey, wine, market, maxRounds } = options;

  const result = await kimiChatWithWebSearch({
    apiKey,
    model: MODEL,
    system: buildPriceSystem(market),
    user: buildPriceUser(wine, market),
    maxRounds,
    maxTokens: 768,
  });

  if (!result.content) {
    return emptyResult(
      result.usage,
      result.error || "Búsqueda de precio sin contenido."
    );
  }

  try {
    const parsed = parsePricePayload(extractJsonObject(result.content));
    if (parsed.priceMxn == null) {
      return {
        ...parsed,
        usage: result.usage,
        error:
          parsed.notes ||
          "La búsqueda no devolvió un precio MXN usable.",
      };
    }
    return { ...parsed, usage: result.usage, error: null };
  } catch (e) {
    return emptyResult(
      result.usage,
      e instanceof Error
        ? `JSON de precio inválido: ${e.message}`
        : "JSON de precio inválido."
    );
  }
}

async function verifyWineRetailPriceOnce(options: {
  apiKey: string;
  wine: WinePriceIdentity;
  market: MarketGeo;
  pass: "local" | "international";
  maxRounds: number;
}): Promise<VerifiedWinePrice> {
  const { apiKey, wine, market, pass, maxRounds } = options;
  const searchMarket =
    pass === "international" ? INTERNATIONAL_PRICE_MARKET : market;

  const result = await kimiChatWithWebSearch({
    apiKey,
    model: MODEL,
    system: buildVerifyPriceSystem(searchMarket, pass),
    user: buildVerifyPriceUser(wine, market, pass),
    maxRounds,
    maxTokens: 512,
  });

  if (!result.content) {
    return emptyVerified(
      result.usage,
      result.error || "Búsqueda de precio sin contenido."
    );
  }

  try {
    const parsed = parseVerifyPayload(extractJsonObject(result.content));
    if (parsed.amount == null) {
      return {
        amount: null,
        currency: null,
        source: pass,
        confidence: parsed.confidence,
        notes: parsed.notes,
        usage: result.usage,
        error: parsed.notes || "No se encontró un precio usable.",
      };
    }
    // Default currency: local market currency, else USD for international.
    const currency =
      parsed.currency ??
      (pass === "local" ? searchMarket.currency : "USD");
    return {
      amount: parsed.amount,
      currency,
      source: pass,
      confidence: parsed.confidence,
      notes: parsed.notes,
      usage: result.usage,
      error: null,
    };
  } catch (e) {
    return emptyVerified(
      result.usage,
      e instanceof Error
        ? `JSON de precio inválido: ${e.message}`
        : "JSON de precio inválido."
    );
  }
}

/**
 * Look up a typical retail bottle price via web search, geo-targeted.
 * Always returns MXN for storage (null if search fails / no reliable price).
 * Retries once when the first pass yields no priceMxn.
 */
export async function researchWineRetailPrice(options: {
  apiKey: string;
  wine: WinePriceIdentity;
  market: MarketGeo;
  maxRounds?: number;
}): Promise<WinePriceResearchResult> {
  const { apiKey, wine, market, maxRounds = PRICE_RESEARCH_MAX_ROUNDS } =
    options;
  if (!wine.name.trim()) {
    return emptyResult(null, "Falta nombre del vino para precio.");
  }

  const first = await researchWineRetailPriceOnce({
    apiKey,
    wine,
    market,
    maxRounds,
  });
  if (first.priceMxn != null) return first;

  console.warn("[wine-price] first pass empty", {
    wine: wine.name,
    market: market.countryCode,
    error: first.error,
  });

  // Only retry when the web-search loop failed entirely (no parseable reply).
  // If the model answered with null price, a second full search rarely helps and
  // risks blowing the client/server timeout while Contar historia waits.
  if (first.notes != null || first.priceLocal != null || first.currency != null) {
    return first;
  }

  const second = await researchWineRetailPriceOnce({
    apiKey,
    wine,
    market,
    maxRounds: Math.min(maxRounds, 3),
  });
  const usage = addKimiUsage(first.usage, second.usage);
  if (second.priceMxn != null) {
    return { ...second, usage, error: null };
  }

  const error =
    second.error || first.error || "Precio no encontrado tras reintento.";
  console.warn("[wine-price] retry also empty", {
    wine: wine.name,
    market: market.countryCode,
    error,
  });
  return {
    priceMxn: null,
    priceLocal: second.priceLocal ?? first.priceLocal,
    currency: second.currency ?? first.currency,
    notes: second.notes ?? first.notes,
    usage,
    error,
  };
}

/**
 * Price-only verification: local market first, then international retail.
 * Returns amount + ISO currency as-is (no forced MXN conversion).
 */
export async function verifyWineRetailPrice(options: {
  apiKey: string;
  wine: WinePriceIdentity;
  market: MarketGeo;
  maxRounds?: number;
}): Promise<VerifiedWinePrice> {
  const { apiKey, wine, market, maxRounds = PRICE_RESEARCH_MAX_ROUNDS } =
    options;
  if (!wine.name.trim()) {
    return emptyVerified(null, "Falta nombre del vino para precio.");
  }

  const local = await verifyWineRetailPriceOnce({
    apiKey,
    wine,
    market,
    pass: "local",
    maxRounds,
  });
  if (local.amount != null && local.currency) {
    return local;
  }

  console.warn("[verify-price] local miss → international", {
    wine: wine.name,
    market: market.countryCode,
    error: local.error,
  });

  const intl = await verifyWineRetailPriceOnce({
    apiKey,
    wine,
    market,
    pass: "international",
    maxRounds: Math.min(maxRounds, 3),
  });
  const usage = addKimiUsage(local.usage, intl.usage);

  if (intl.amount != null && intl.currency) {
    return { ...intl, usage, error: null };
  }

  return {
    amount: null,
    currency: null,
    source: null,
    confidence: intl.confidence ?? local.confidence,
    notes: intl.notes ?? local.notes,
    usage,
    error:
      intl.error ||
      local.error ||
      "Precio no encontrado en mercado local ni internacional.",
  };
}
