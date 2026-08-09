import { extractJsonObject } from "@/lib/scan-label";
import type { Wine } from "@/lib/types";

/** Slim cellar row sent to the model (keeps tokens bounded). */
export type PairMealWineInput = {
  id: string;
  name: string;
  winery: string;
  country: string;
  region: string;
  type: string;
  grape: string;
  aging: string;
  vintage: number | null;
  cavataleRating: number | null;
  slot: string | null;
  knownPairings: string[] | null;
};

export type PairMealAlternative = {
  wineId: string;
  reason: string;
};

export type PairMealResult = {
  wineId: string;
  reason: string;
  matchNote: string;
  alternatives: PairMealAlternative[];
};

export const PAIR_MEAL_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    wineId: { type: "STRING" },
    reason: { type: "STRING" },
    matchNote: { type: "STRING" },
    alternatives: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          wineId: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["wineId", "reason"],
      },
    },
  },
  required: ["wineId", "reason", "matchNote", "alternatives"],
};

const MAX_WINES = 90;
const MAX_DISH_CHARS = 400;

export function normalizeDishDescription(raw: string): string | null {
  const dish = raw.replace(/\s+/g, " ").trim();
  if (dish.length < 2) return null;
  return dish.slice(0, MAX_DISH_CHARS);
}

export function slimWinesForPairMeal(wines: Wine[]): PairMealWineInput[] {
  const scored = [...wines].sort((a, b) => {
    const score = (w: Wine) =>
      (w.grape ? 2 : 0) +
      (w.type ? 1 : 0) +
      (w.cavataleRating != null ? 2 : 0) +
      (w.kimiPairings?.length ? 3 : 0);
    return score(b) - score(a);
  });
  return scored.slice(0, MAX_WINES).map((w) => ({
    id: w.id,
    name: w.name,
    winery: w.winery || "",
    country: w.country || "",
    region: w.region || "",
    type: w.type || "",
    grape: w.grape || "",
    aging: w.aging || "",
    vintage: w.vintage,
    cavataleRating: w.cavataleRating,
    slot: w.slot,
    knownPairings: w.kimiPairings?.slice(0, 4) ?? null,
  }));
}

export function buildPairMealSystemPrompt(locale: "es" | "en"): string {
  if (locale === "en") {
    return `You are Cavatale's cellar sommelier. The user will describe a meal; you MUST pick the best bottle from THEIR cellar list only (use the exact wine id).

Rules:
- Choose only from the provided wines. Never invent a bottle.
- Prefer a realistic food↔wine match (body, acidity, tannin, style, grape, aging) over folklore.
- Prefer bottles that already list relevant knownPairings when they fit.
- Prefer opening something memorable when several wines fit equally — slight bias to higher cavataleRating — but fit to the food wins.
- matchNote: one short pairing thread (max ~12 words). No fluff.
- reason: ONE brief paragraph (2–4 short sentences, max ~60 words). Precise and concrete: name the dish cues (fat, spice, smoke, sauce, intensity) and the wine cues (grape/style/aging/body) that make the match. Say why this bottle over a generic "goes well". No poetic filler, no tasting-note spam, no "perfect balance".
- alternatives: 0–2 other cellar ids with a one-line concrete reason each. Different from the winner.
- Respond with JSON only matching the schema.`;
  }
  return `Eres el sommelier de la cava personal en Cavatale. El usuario describe qué va a comer; DEBES elegir la mejor botella SOLO de SU lista (usa el id exacto).

Reglas:
- Elige únicamente entre los vinos dados. Nunca inventes una botella.
- Prioriza un maridaje realista (cuerpo, acidez, tanino, estilo, uva, crianza) sobre tipismos.
- Si un vino ya trae knownPairings que encajan con la comida, considéralo fuerte.
- Si varios encajan igual, prefiere algo memorable (ligera preferencia por cavataleRating más alto) — pero gana el ajuste a la comida.
- matchNote: 1 línea corta con el hilo del maridaje (máx. ~12 palabras). Sin relleno.
- reason: UN párrafo breve (2–4 frases cortas, máx. ~60 palabras). Concreto y preciso: nombra señales de la comida (grasa, picante, humo, salsa, intensidad) y del vino (uva/estilo/crianza/cuerpo) que justifican la elección. Explica por qué ESTA botella, no un "queda bien" genérico. Sin poesía vacía, sin catálogo de aromas, sin "equilibrio perfecto".
- alternatives: 0–2 otros ids de la cava con razón de una línea, concreta. Distintos al ganador.
- Responde SOLO JSON válido según el schema.
- Idioma: español natural (México/LatAm) en reason y matchNote.`;
}

export function buildPairMealUserPrompt(
  dish: string,
  wines: PairMealWineInput[],
  marketLabel: string
): string {
  return `Comida / momento: ${dish}

Mercado del usuario (contexto de mesa): ${marketLabel}

Cava disponible (${wines.length} botellas) — JSON:
${JSON.stringify(wines)}

Elige el mejor vino para abrir ahora con esa comida.
En reason escribe un párrafo breve y preciso justificando la elección (comida ↔ vino).`;
}

function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

export function parsePairMealResult(
  raw: unknown,
  allowedIds: Set<string>
): PairMealResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Respuesta de maridaje inválida.");
  }
  const o = raw as Record<string, unknown>;
  const wineId = asString(o.wineId ?? o.id ?? o.wine_id);
  if (!wineId || !allowedIds.has(wineId)) {
    throw new Error("La IA eligió un vino que no está en tu cava.");
  }
  const reason = asString(o.reason ?? o.why ?? o.explanation);
  const matchNote = asString(o.matchNote ?? o.pairingNote ?? o.note);
  if (!reason) {
    throw new Error("La IA no explicó la recomendación.");
  }

  const alternatives: PairMealAlternative[] = [];
  const altRaw = o.alternatives ?? o.runnersUp ?? o.other;
  if (Array.isArray(altRaw)) {
    for (const item of altRaw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = asString(row.wineId ?? row.id);
      const altReason = asString(row.reason);
      if (!id || id === wineId || !allowedIds.has(id) || !altReason) continue;
      alternatives.push({ wineId: id, reason: altReason });
      if (alternatives.length >= 2) break;
    }
  }

  return {
    wineId,
    reason,
    matchNote: matchNote || reason.split(/(?<=[.!?])\s/)[0] || reason,
    alternatives,
  };
}

export function parsePairMealFromModelText(
  text: string,
  allowedIds: Set<string>
): PairMealResult {
  return parsePairMealResult(extractJsonObject(text), allowedIds);
}
