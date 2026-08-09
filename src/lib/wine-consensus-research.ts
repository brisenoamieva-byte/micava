/**
 * Market consensus rating lookup (Vivino community + Wine-Searcher aggregate)
 * via Kimi $web_search — same pattern as price research.
 */

import { extractJsonObject } from "@/lib/scan-label";
import { kimiChatWithWebSearch } from "@/lib/kimi-web-search";
import type { KimiTokenUsage } from "@/lib/kimi-usage";

const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
export const CONSENSUS_RESEARCH_MAX_ROUNDS = 3;

/** Market scores use one decimal (Vivino-style), not half-points. */
export function snapMarketScore(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const snapped = Math.round(value * 10) / 10;
  if (snapped < 1 || snapped > 5) return null;
  return snapped;
}

export type WineConsensusIdentity = {
  name: string;
  winery?: string;
  country?: string;
  region?: string;
  vintage?: number | null;
  type?: string;
};

export type WineConsensusResult = {
  /** Blended 1–5 market score ready for Cavatale hybrid formula. */
  score: number | null;
  vivino: number | null;
  wineSearcher100: number | null;
  source: "vivino" | "wine-searcher" | "blended" | null;
  confidence: "high" | "medium" | "low" | null;
  notes: string | null;
  usage: KimiTokenUsage | null;
  error: string | null;
};

/** Map Wine-Searcher / critic 50–100 aggregate onto a Vivino-like 1–5 band. */
export function critic100ToFiveScale(score100: number): number | null {
  if (!Number.isFinite(score100)) return null;
  const s = Math.min(100, Math.max(50, score100));
  // 50→1.0 … 100→5.0 linear, then snap to one decimal.
  const raw = 1 + ((s - 50) / 50) * 4;
  return snapMarketScore(raw);
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function asStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function clampVivino(n: number | null): number | null {
  if (n == null) return null;
  if (n < 1 || n > 5) return null;
  return snapMarketScore(n);
}

export function blendMarketScores(
  vivino: number | null,
  wineSearcher100: number | null
): {
  score: number | null;
  source: WineConsensusResult["source"];
} {
  const v = clampVivino(vivino);
  const ws = critic100ToFiveScale(wineSearcher100 ?? NaN);
  if (v != null && ws != null) {
    const blended = snapMarketScore(v * 0.7 + ws * 0.3);
    return { score: blended, source: "blended" };
  }
  if (v != null) return { score: v, source: "vivino" };
  if (ws != null) return { score: ws, source: "wine-searcher" };
  return { score: null, source: null };
}

/**
 * Prefer a stable prior when the new lookup only wobbles slightly.
 * Does not freeze — large market moves still apply.
 */
export function stabilizeMarketScore(
  prior: number | null | undefined,
  incoming: number | null,
  maxWobble = 0.15
): number | null {
  if (incoming == null) {
    return prior != null && Number.isFinite(prior)
      ? snapMarketScore(prior)
      : null;
  }
  if (prior == null || !Number.isFinite(prior)) return incoming;
  if (Math.abs(incoming - prior) <= maxWobble) return snapMarketScore(prior);
  return incoming;
}

function buildConsensusSystem(): string {
  return `Eres un investigador de calificaciones públicas de vino. Usa $web_search.
Busca SOLO el promedio comunitario Vivino (escala 1–5) y/o el score agregado Wine-Searcher (0–100) de ESTA botella y cosecha.
NO inventes números. Si no hay dato claro para esa identidad/vintage, usa null.
Devuelve SOLO JSON:
{"vivino":number|null,"wineSearcher100":number|null,"confidence":"high"|"medium"|"low","notes":string}`;
}

function buildConsensusUser(wine: WineConsensusIdentity): string {
  const vintage =
    wine.vintage != null && Number.isFinite(wine.vintage)
      ? String(wine.vintage)
      : "sin añada";
  return `Identidad exacta:
- Nombre: ${wine.name}
- Bodega: ${wine.winery || "—"}
- País/región: ${wine.country || "—"} / ${wine.region || "—"}
- Tipo: ${wine.type || "—"}
- Cosecha: ${vintage}

Busca en Vivino el average rating (1–5) y en Wine-Searcher el aggregate critic score (≈0–100) de ESTA botella.
Prefiere la misma cosecha; si solo hay “all vintages”, anótalo en notes y baja confidence.
JSON final obligatorio.`;
}

function emptyResult(
  usage: KimiTokenUsage | null,
  error: string
): WineConsensusResult {
  return {
    score: null,
    vivino: null,
    wineSearcher100: null,
    source: null,
    confidence: null,
    notes: null,
    usage,
    error,
  };
}

/**
 * Look up public market ratings for a bottle (Vivino + Wine-Searcher).
 */
export async function researchWineMarketConsensus(options: {
  apiKey: string;
  wine: WineConsensusIdentity;
  priorScore?: number | null;
}): Promise<WineConsensusResult> {
  const { apiKey, wine, priorScore } = options;

  const result = await kimiChatWithWebSearch({
    apiKey,
    model: MODEL,
    system: buildConsensusSystem(),
    user: buildConsensusUser(wine),
    maxRounds: CONSENSUS_RESEARCH_MAX_ROUNDS,
    maxTokens: 512,
  });

  if (!result.content) {
    const kept = stabilizeMarketScore(priorScore ?? null, null);
    return {
      ...emptyResult(
        result.usage,
        result.error || "Búsqueda de consenso sin contenido."
      ),
      score: kept,
      vivino: kept,
      source: kept != null ? "vivino" : null,
      notes: "Se reutilizó consenso previo por fallo de búsqueda.",
      error: null,
    };
  }

  try {
    const raw = extractJsonObject(result.content) as Record<string, unknown>;
    const vivino = clampVivino(asNum(raw.vivino ?? raw.vivinoRating));
    const wineSearcher100 = asNum(
      raw.wineSearcher100 ?? raw.wine_searcher ?? raw.criticScore ?? raw.score
    );
    const wsOk =
      wineSearcher100 != null &&
      wineSearcher100 >= 50 &&
      wineSearcher100 <= 100
        ? wineSearcher100
        : null;
    const { score: blended, source } = blendMarketScores(vivino, wsOk);
    const score = stabilizeMarketScore(priorScore ?? null, blended);
    const confidenceRaw = asStr(raw.confidence)?.toLowerCase();
    const confidence =
      confidenceRaw === "high" ||
      confidenceRaw === "medium" ||
      confidenceRaw === "low"
        ? confidenceRaw
        : null;

    if (score == null) {
      return {
        score: null,
        vivino,
        wineSearcher100: wsOk,
        source: null,
        confidence,
        notes: asStr(raw.notes),
        usage: result.usage,
        error: "Sin rating público usable para esta botella.",
      };
    }

    return {
      score,
      vivino,
      wineSearcher100: wsOk,
      source,
      confidence,
      notes: asStr(raw.notes),
      usage: result.usage,
      error: null,
    };
  } catch (e) {
    const kept = stabilizeMarketScore(priorScore ?? null, null);
    return {
      ...emptyResult(
        result.usage,
        e instanceof Error
          ? `JSON de consenso inválido: ${e.message}`
          : "JSON de consenso inválido."
      ),
      score: kept,
      vivino: kept,
      source: kept != null ? "vivino" : null,
      error: null,
      notes: "Se reutilizó consenso previo por JSON inválido.",
    };
  }
}
