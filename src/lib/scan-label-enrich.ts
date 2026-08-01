/**
 * Web enrichment for scan results (Vivino + MXN price + identity confirm).
 * Kept separate from vision so the client can show identity immediately.
 */

import { kimiChatWithWebSearch } from "@/lib/kimi-web-search";
import type { KimiTokenUsage } from "@/lib/kimi-usage";
import {
  extractJsonObject,
  parseScanLabelResult,
  type ScanLabelFields,
} from "@/lib/scan-label";
import { wineCountriesForPrompt } from "@/lib/wine-countries";

const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
/** Cap tool rounds — each round is a full LLM + search trip. */
export const ENRICH_MAX_ROUNDS = 2;

const COUNTRY_PROMPT = wineCountriesForPrompt();

export const ENRICH_SYSTEM = `Eres un investigador de vinos para Cavatale (México).
Debes USAR la búsqueda web ($web_search) para confirmar identidad, rating Vivino y precio de referencia en MXN.
Responde SOLO con JSON válido (sin markdown) con EXACTAMENTE:
name, winery, country, region, type, grape, aging, vintage, vivino, price, confidence, notes.

Reglas:
- Busca primero en Vivino / sitios de vino / tiendas MX (La Europea, Vinoteca, Amazon MX, etc.).
- country: exactamente uno de: ${COUNTRY_PROMPT}. Usa el nombre en español de la lista.
- vivino: número 1–5 (un decimal ok) del vino/cosecha si aparece; si solo hay rango, toma el más citado; si no hay dato fiable, null.
- price: entero MXN de menudeo típico actual o reciente; si solo USD/EUR, convierte aprox. a MXN; si no hay, null.
- No inventes ratings ni precios. Prefiere null a inventar.
- Si la búsqueda corrige el nombre/bodega/país, actualízalos.
- notes: qué fuentes usaste en una frase corta (sin URLs largas).
- Usa como máximo 1–2 búsquedas: prioriza Vivino rating + precio México en consultas cortas.`;

export type EnrichHint = {
  matchMethod?: string;
  searchQuery?: string;
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
  hint: EnrichHint
): string {
  if (hint.searchQuery?.trim()) return hint.searchQuery.trim();
  const parts = [
    fields.name,
    fields.winery,
    fields.vintage != null ? String(fields.vintage) : "",
    fields.region,
    "Vivino",
    "precio México",
  ].filter(Boolean);
  return parts.join(" ");
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
    vintage: pickNum(base.vintage, enriched.vintage),
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

  const query = buildSearchQuery(fields, hint);
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
- consulta sugerida: ${query}

Usa $web_search (máximo 1–2 búsquedas: Vivino rating y/o precio México) y devuelve el JSON final con vivino y price rellenados cuando existan datos públicos.`;

  const result = await kimiChatWithWebSearch({
    apiKey,
    model: MODEL,
    system: ENRICH_SYSTEM,
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
