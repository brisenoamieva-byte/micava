/**
 * Web enrichment for scan results (Vivino + retail price + identity confirm).
 * Kept separate from vision so the client can show identity immediately.
 */

import { kimiChatWithWebSearch } from "@/lib/kimi-web-search";
import type { KimiTokenUsage } from "@/lib/kimi-usage";
import { resolveMarketGeo, type MarketGeo } from "@/lib/market-geo";
import {
  extractJsonObject,
  parseScanLabelResult,
  type ScanLabelFields,
} from "@/lib/scan-label";
import { wineCountriesForPrompt } from "@/lib/wine-countries";
import { buildWinePriceSearchQuery } from "@/lib/wine-price-research";

const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
/** Cap tool rounds — need searches + 1 for final JSON (see kimi-web-search). */
export const ENRICH_MAX_ROUNDS = 4;

const COUNTRY_PROMPT = wineCountriesForPrompt();

function enrichSystemForMarket(market: MarketGeo): string {
  return `Eres un investigador de vinos para Cavatale (${market.marketLabel}).
Debes USAR la búsqueda web ($web_search) para confirmar identidad, rating Vivino y precio de referencia en ${market.currency}.
Responde SOLO con JSON válido (sin markdown) con EXACTAMENTE:
name, winery, country, region, type, grape, aging, vintage, vivino, price, confidence, notes.

Reglas:
- Busca primero en Vivino / sitios de vino / tiendas (${market.retailersHint}).
- IDENTIDAD ESTRICTA: confirma la MISMA línea + crianza/designación + uva + cosecha cuando constan en la ficha.
  No sustituyas por otra variante de la misma bodega (Joven≠Reserva; otra uva = otro vino).
- Si el escaneo ya trae vintage (cosecha leída en etiqueta), NO lo cambies por otra añada del catálogo. Solo rellena vintage si venía null.
- country: exactamente uno de: ${COUNTRY_PROMPT}. Usa el nombre en español de la lista.
- vivino: número 1–5 (un decimal ok) SOLO si el hit es esa SKU/cosecha; si solo hay all-vintages u otra variante, null.
- price: entero en ${market.currency} de menudeo típico de ESA variante; si el precio es de otra crianza/línea, null. Si solo hay otra moneda, convierte aprox. a ${market.currency}.
- No inventes ratings ni precios. Prefiere null a inventar.
- Si la búsqueda corrige tipografía del nombre/bodega SIN cambiar de SKU, actualízalos. No “corrijas” hacia otra línea.
- notes: qué fuentes usaste en una frase corta (sin URLs largas).
- Usa como máximo 1–2 búsquedas: prioriza Vivino rating + precio ${market.searchPriceHint} en consultas cortas con crianza+añada.`;
}

export type EnrichHint = {
  matchMethod?: string;
  searchQuery?: string;
  /** ISO country for retail market (defaults MX). */
  countryCode?: string | null;
};

/** True when market data is incomplete and a web pass is worth it. */
export function needsMarketEnrich(fields: ScanLabelFields): boolean {
  if (!fields.name.trim()) return false;
  if (
    fields.vivino != null &&
    fields.price != null &&
    fields.confidence === "high"
  ) {
    return false;
  }
  return true;
}

export function buildSearchQuery(
  fields: ScanLabelFields,
  hint: EnrichHint,
  market: MarketGeo = resolveMarketGeo({ countryCode: hint.countryCode })
): string {
  if (hint.searchQuery?.trim()) return hint.searchQuery.trim();
  const priceQuery = buildWinePriceSearchQuery(
    {
      name: fields.name,
      winery: fields.winery,
      region: fields.region,
      vintage: fields.vintage,
      grape: fields.grape,
      aging: fields.aging,
      type: fields.type,
    },
    market
  );
  return [priceQuery, "Vivino"].filter(Boolean).join(" ");
}

export function mergeEnrichment(
  base: ScanLabelFields,
  enriched: ScanLabelFields
): ScanLabelFields {
  const pickStr = (a: string, b: string) => (b.trim() ? b : a);
  const pickNum = (a: number | null, b: number | null) =>
    b != null ? b : a;

  return {
    name: pickStr(base.name, enriched.name) || base.name,
    winery: pickStr(base.winery, enriched.winery),
    country:
      enriched.country && enriched.country !== "Otro"
        ? enriched.country
        : base.country,
    region: pickStr(base.region, enriched.region),
    type: enriched.type || base.type,
    grape: pickStr(base.grape, enriched.grape),
    aging: pickStr(base.aging, enriched.aging),
    // Label OCR vintage wins: web catalogs often mix harvest years.
    vintage: base.vintage != null ? base.vintage : enriched.vintage,
    vivino: pickNum(base.vivino, enriched.vivino),
    price: pickNum(base.price, enriched.price),
    confidence:
      enriched.confidence === "high" || base.confidence === "high"
        ? enriched.vivino != null || enriched.price != null
          ? enriched.confidence === "low"
            ? base.confidence
            : enriched.confidence
          : base.confidence === "high"
            ? "high"
            : enriched.confidence
        : enriched.confidence !== "low"
          ? enriched.confidence
          : base.confidence,
    notes: [base.notes, enriched.notes].filter(Boolean).join(" · ").slice(0, 280),
  };
}

export async function enrichWithWeb(
  apiKey: string,
  fields: ScanLabelFields,
  hint: EnrichHint
): Promise<{ fields: ScanLabelFields | null; usage: KimiTokenUsage | null }> {
  if (!needsMarketEnrich(fields)) {
    return { fields: null, usage: null };
  }

  const market = resolveMarketGeo({ countryCode: hint.countryCode });
  const query = buildSearchQuery(fields, hint, market);
  if (!query.trim() && !fields.name) return { fields: null, usage: null };

  const user = `Identidad tentativa del vino (puede venir de foto con poco texto):
- name: ${fields.name || "(desconocido)"}
- winery: ${fields.winery || ""}
- country: ${fields.country}
- region: ${fields.region}
- type: ${fields.type}
- grape: ${fields.grape}
- aging: ${fields.aging}
- vintage: ${fields.vintage ?? ""}
- matchMethod: ${hint.matchMethod || ""}
- notes visuales: ${fields.notes || ""}
- mercado: ${market.marketLabel} (${market.currency})
- consulta sugerida: ${query}

Usa $web_search (máximo 1–2 búsquedas: Vivino rating y/o precio ${market.searchPriceHint}) y devuelve el JSON final con vivino y price rellenados cuando existan datos públicos.`;

  const result = await kimiChatWithWebSearch({
    apiKey,
    model: MODEL,
    system: enrichSystemForMarket(market),
    user,
    maxRounds: ENRICH_MAX_ROUNDS,
    maxTokens: 1536,
  });

  if (!result.content) return { fields: null, usage: result.usage };

  try {
    const raw = extractJsonObject(result.content);
    return { fields: parseScanLabelResult(raw), usage: result.usage };
  } catch {
    return { fields: null, usage: result.usage };
  }
}
