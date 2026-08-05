/**
 * Geo-aware retail price lookup via Kimi $web_search.
 * Stores MXN only (UI/formatPrice is MXN); converts local prices when needed.
 */

import { extractJsonObject } from "@/lib/scan-label";
import { kimiChatWithWebSearch } from "@/lib/kimi-web-search";
import type { KimiTokenUsage } from "@/lib/kimi-usage";
import type { MarketGeo } from "@/lib/market-geo";

const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
/** Cap tool rounds — price lookup should stay cheap. */
export const PRICE_RESEARCH_MAX_ROUNDS = 2;

export type WinePriceIdentity = {
  name: string;
  winery?: string;
  country?: string;
  region?: string;
  vintage?: number | null;
  type?: string;
  grape?: string;
};

export type WinePriceResearchResult = {
  /** Typical retail bottle price in MXN (integer), ready for kimiPrice. */
  priceMxn: number | null;
  /** Local currency amount before conversion (if known). */
  priceLocal: number | null;
  currency: string | null;
  notes: string | null;
  usage: KimiTokenUsage | null;
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

export function buildWinePriceSearchQuery(
  wine: WinePriceIdentity,
  market: MarketGeo
): string {
  return [
    wine.name,
    wine.winery,
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
    ? `- priceMxn: entero MXN de menudeo típico actual o reciente en México. Si ves varios precios, usa un promedio/típico razonable (no el mínimo de oferta rara).`
    : `- Busca precio de menudeo típico en ${market.marketLabel} (${market.currency}).
- priceLocal: entero en ${market.currency} (sin decimales forzados a entero redondeado).
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
- No inventes precios. Prefiere null a inventar.
- Usa como máximo 1–2 búsquedas cortas enfocadas en precio retail de esta botella/cosecha.
- notes: una frase corta sobre fuentes (sin URLs largas). Si convertiste a MXN, menciónalo.`;
}

function buildPriceUser(wine: WinePriceIdentity, market: MarketGeo): string {
  const query = buildWinePriceSearchQuery(wine, market);
  return `Estima el precio de menudeo típico de esta botella para el mercado ${market.marketLabel}:

- name: ${wine.name}
- winery: ${wine.winery || ""}
- country: ${wine.country || ""}
- region: ${wine.region || ""}
- type: ${wine.type || ""}
- grape: ${wine.grape || ""}
- vintage: ${wine.vintage ?? ""}
- consulta sugerida: ${query}

Usa $web_search (máximo 1–2 búsquedas) y devuelve JSON con priceMxn rellenado cuando haya datos públicos fiables.`;
}

function parsePricePayload(raw: unknown): Omit<
  WinePriceResearchResult,
  "usage"
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
  const priceMxn = clampPriceMxn(
    asOptionalNumber(o.priceMxn ?? o.price_mxn ?? o.price ?? o.kimiPrice)
  );
  const priceLocal = asOptionalNumber(o.priceLocal ?? o.price_local);
  const currency = asString(o.currency).toUpperCase() || null;
  const notes = asString(o.notes) || null;
  return {
    priceMxn,
    priceLocal:
      priceLocal != null && priceLocal > 0 ? Math.round(priceLocal) : null,
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    notes,
  };
}

/**
 * Look up a typical retail bottle price via web search, geo-targeted.
 * Always returns MXN for storage (null if search fails / no reliable price).
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
    return {
      priceMxn: null,
      priceLocal: null,
      currency: null,
      notes: null,
      usage: null,
    };
  }

  const result = await kimiChatWithWebSearch({
    apiKey,
    model: MODEL,
    system: buildPriceSystem(market),
    user: buildPriceUser(wine, market),
    maxRounds,
    maxTokens: 768,
  });

  if (!result.content) {
    return {
      priceMxn: null,
      priceLocal: null,
      currency: null,
      notes: null,
      usage: result.usage,
    };
  }

  try {
    const parsed = parsePricePayload(extractJsonObject(result.content));
    return { ...parsed, usage: result.usage };
  } catch {
    return {
      priceMxn: null,
      priceLocal: null,
      currency: null,
      notes: null,
      usage: result.usage,
    };
  }
}
