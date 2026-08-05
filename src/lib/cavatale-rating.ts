/**
 * Cavatale official score methodology.
 *
 * Consistency comes from a fixed evidence checklist + deterministic mapping
 * in code — not from clamping to a previous score. Same evidence → same axes
 * → same weighted total. The LLM classifies facts into enums; it does not
 * invent the final decimal.
 */

/** Four judged axes; final score is a fixed weighted formula (not a free LLM decimal). */
export type CavataleRatingParts = {
  taste: number;
  story: number;
  table: number;
  originality: number;
};

export const CAVATALE_RATING_WEIGHTS = {
  taste: 0.3,
  story: 0.3,
  table: 0.25,
  originality: 0.15,
} as const;

/** Snap to half-points 1.0–5.0 so component scores stay comparable across runs. */
export function snapHalfPoint(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const snapped = Math.round(value * 2) / 2;
  if (snapped < 1 || snapped > 5) return null;
  return snapped;
}

/** Deterministic official score from the four axes. */
export function computeCavataleRatingFromParts(
  parts: CavataleRatingParts
): number {
  const raw =
    parts.taste * CAVATALE_RATING_WEIGHTS.taste +
    parts.story * CAVATALE_RATING_WEIGHTS.story +
    parts.table * CAVATALE_RATING_WEIGHTS.table +
    parts.originality * CAVATALE_RATING_WEIGHTS.originality;
  return Math.round(raw * 10) / 10;
}

function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseCavataleRatingParts(
  raw: unknown
): CavataleRatingParts | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const taste = snapHalfPoint(
    asOptionalNumber(o.taste ?? o.sabor ?? o.copa ?? o.flavor)
  );
  const story = snapHalfPoint(
    asOptionalNumber(o.story ?? o.historia ?? o.authenticity ?? o.autenticidad)
  );
  const table = snapHalfPoint(
    asOptionalNumber(o.table ?? o.mesa ?? o.experience ?? o.experiencia)
  );
  const originality = snapHalfPoint(
    asOptionalNumber(
      o.originality ?? o.interes ?? o.interest ?? o.originalidad
    )
  );
  if (
    taste == null ||
    story == null ||
    table == null ||
    originality == null
  ) {
    return null;
  }
  return { taste, story, table, originality };
}

export type CraftLevel =
  | "unknown"
  | "basic"
  | "sound"
  | "fine"
  | "outstanding";
export type PeopleLevel = "none" | "generic" | "named" | "rich";
export type PlaceFactsLevel =
  | "none"
  | "regionOnly"
  | "bottleSpecific"
  | "intimate";
export type TellabilityLevel = "none" | "mild" | "strong" | "magnetic";
export type DistinctivenessLevel =
  | "commodity"
  | "typical"
  | "distinct"
  | "rare";
export type AgingTier = "none" | "entry" | "aged" | "reservaPlus";

/** Structured evidence the model must classify; scores are derived in code. */
export type CavataleRatingEvidence = {
  craft: CraftLevel;
  people: PeopleLevel;
  placeFacts: PlaceFactsLevel;
  tellability: TellabilityLevel;
  distinctiveness: DistinctivenessLevel;
  agingTier: AgingTier;
};

const CRAFT: readonly CraftLevel[] = [
  "unknown",
  "basic",
  "sound",
  "fine",
  "outstanding",
];
const PEOPLE: readonly PeopleLevel[] = ["none", "generic", "named", "rich"];
const PLACE: readonly PlaceFactsLevel[] = [
  "none",
  "regionOnly",
  "bottleSpecific",
  "intimate",
];
const TELL: readonly TellabilityLevel[] = [
  "none",
  "mild",
  "strong",
  "magnetic",
];
const DISTINCT: readonly DistinctivenessLevel[] = [
  "commodity",
  "typical",
  "distinct",
  "rare",
];
const AGING: readonly AgingTier[] = [
  "none",
  "entry",
  "aged",
  "reservaPlus",
];

function pickEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export function parseCavataleRatingEvidence(
  raw: unknown
): CavataleRatingEvidence | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const craft = pickEnum(o.craft ?? o.calidad ?? o.tasteCraft, CRAFT);
  const people = pickEnum(o.people ?? o.personas ?? o.humans, PEOPLE);
  const placeFacts = pickEnum(o.placeFacts ?? o.lugar ?? o.place, PLACE);
  const tellability = pickEnum(
    o.tellability ?? o.mesa ?? o.tableHook,
    TELL
  );
  const distinctiveness = pickEnum(
    o.distinctiveness ?? o.originality ?? o.rareza,
    DISTINCT
  );
  const agingTier = pickEnum(
    o.agingTier ?? o.aging ?? o.añejamiento,
    AGING
  );
  if (
    !craft ||
    !people ||
    !placeFacts ||
    !tellability ||
    !distinctiveness ||
    !agingTier
  ) {
    return null;
  }
  return {
    craft,
    people,
    placeFacts,
    tellability,
    distinctiveness,
    agingTier,
  };
}

/** Infer aging tier from ficha text (deterministic; complements model enum). */
export function inferAgingTierFromFicha(
  aging: string | null | undefined
): AgingTier {
  const a = (aging ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!a.trim()) return "none";
  if (
    /gran\s*reserva|reserva\s+especial|vieilles?\s*vignes|old\s*vines?|extra\s*aged|premier\s*cru|grand\s*cru/.test(
      a
    )
  ) {
    return "reservaPlus";
  }
  if (
    /reserva|crianza|barrica|roble|oak|elevage|eleve|aged|anada|años?|meses|months|years/.test(
      a
    )
  ) {
    return "aged";
  }
  if (/joven|young|sin\s*barrica|unoaked|sin\s*crianza/.test(a)) {
    return "entry";
  }
  return "none";
}

const AGING_RANK: Record<AgingTier, number> = {
  none: 0,
  entry: 1,
  aged: 2,
  reservaPlus: 3,
};

function mergeAgingTier(a: AgingTier, b: AgingTier): AgingTier {
  return AGING_RANK[a] >= AGING_RANK[b] ? a : b;
}

/** Enough signal to publish a score (not pure guesswork). */
export function evidenceIsScorable(e: CavataleRatingEvidence): boolean {
  if (e.craft !== "unknown") return true;
  if (e.people === "named" || e.people === "rich") return true;
  if (e.placeFacts === "bottleSpecific" || e.placeFacts === "intimate") {
    return true;
  }
  return false;
}

function clampHalf(n: number): number {
  return snapHalfPoint(Math.min(5, Math.max(1, n))) ?? 1;
}

/** taste = craft reputation/style clarity + aging signal (not palate fantasy). */
export function mapTasteAxis(e: CavataleRatingEvidence): number {
  const base: Record<CraftLevel, number> = {
    unknown: 2.5,
    basic: 2.0,
    sound: 3.0,
    fine: 4.0,
    outstanding: 4.5,
  };
  let score = base[e.craft];
  if (e.craft === "sound" || e.craft === "fine" || e.craft === "outstanding") {
    if (e.agingTier === "aged" || e.agingTier === "reservaPlus") score += 0.5;
  }
  return clampHalf(score);
}

/** story = named humans + bottle-specific place facts. */
export function mapStoryAxis(e: CavataleRatingEvidence): number {
  const people: Record<PeopleLevel, number> = {
    none: 1.5,
    generic: 2.5,
    named: 3.5,
    rich: 4.5,
  };
  const placeAdj: Record<PlaceFactsLevel, number> = {
    none: -0.5,
    regionOnly: 0,
    bottleSpecific: 0.5,
    intimate: 1.0,
  };
  return clampHalf(people[e.people] + placeAdj[e.placeFacts]);
}

/** table = how tellable the real facts are at dinner. */
export function mapTableAxis(e: CavataleRatingEvidence): number {
  const base: Record<TellabilityLevel, number> = {
    none: 2.0,
    mild: 3.0,
    strong: 4.0,
    magnetic: 4.5,
  };
  let score = base[e.tellability];
  if (
    (e.people === "named" || e.people === "rich") &&
    e.tellability !== "none"
  ) {
    score += 0.5;
  }
  return clampHalf(score);
}

/** originality = distinctiveness vs commodity, with place specificity boost. */
export function mapOriginalityAxis(e: CavataleRatingEvidence): number {
  const base: Record<DistinctivenessLevel, number> = {
    commodity: 1.5,
    typical: 2.5,
    distinct: 3.5,
    rare: 4.5,
  };
  let score = base[e.distinctiveness];
  if (
    e.distinctiveness !== "commodity" &&
    (e.placeFacts === "bottleSpecific" || e.placeFacts === "intimate")
  ) {
    score += 0.5;
  }
  return clampHalf(score);
}

/**
 * Map structured evidence → four half-point axes (deterministic).
 * Optionally merge ficha aging text into agingTier.
 */
export function computePartsFromEvidence(
  evidence: CavataleRatingEvidence,
  ficha?: { aging?: string | null }
): CavataleRatingParts | null {
  const agingTier = mergeAgingTier(
    evidence.agingTier,
    inferAgingTierFromFicha(ficha?.aging)
  );
  const e: CavataleRatingEvidence = { ...evidence, agingTier };
  if (!evidenceIsScorable(e)) return null;
  return {
    taste: mapTasteAxis(e),
    story: mapStoryAxis(e),
    table: mapTableAxis(e),
    originality: mapOriginalityAxis(e),
  };
}

export function computeOfficialFromEvidence(
  evidence: CavataleRatingEvidence,
  ficha?: { aging?: string | null }
): number | null {
  const parts = computePartsFromEvidence(evidence, ficha);
  return parts ? computeCavataleRatingFromParts(parts) : null;
}

/** Prompt block: explicit rubric + enum checklist (shared by research-wine). */
export const CAVATALE_RATING_RUBRIC_PROMPT = `## Rating Cavatale — metodología fija (reproducible)

El score oficial NO es un decimal inventado. Clasifica EVIDENCIA en enums; el SERVIDOR calcula ejes y el total con pesos fijos:
  0.30*taste + 0.30*story + 0.25*table + 0.15*originality (un decimal).

Devuelve OBLIGATORIAMENTE ratingEvidence (objeto) si la identidad es clara.
ratingParts es opcional (auto-chequeo legado); el servidor prioriza ratingEvidence y NUNCA toma cavataleRating libre como fuente de verdad si hay evidencia o partes.

### ratingEvidence — elige EXACTAMENTE uno por campo (criterios concretos)

craft (calidad/reputación de elaboración de ESTA botella/línea — no tu gusto personal):
- unknown: no hay señales serias de calidad de ESTA etiqueta
- basic: commodity / entry genérico sin prestigio de línea
- sound: bien hecho, productor serio, tipicidad correcta (la mayoría de buenos vinos de mesa)
- fine: reputación clara de calidad (crítica/pares/estilo reconocido de la casa/línea)
- outstanding: referencia de categoría (muy raro; solo con consenso claro)

people (humanos verificables en el relato de ESTA bodega/botella):
- none: no conoces personas
- generic: "una familia" / "el enólogo" sin nombre ni vínculo concreto
- named: al menos un nombre propio real (fundador, dueño, enólogo) de ESTA casa
- rich: nombres + vínculo/decisión humana concreta (padre/hijo, herencia, gesto fundacional)

placeFacts (especificidad del lugar/botella — no folleto de DO):
- none: sin hechos de lugar
- regionOnly: solo región/DO genérica
- bottleSpecific: viñedo, pueblo, parcela, añada o decisión de elaboración de ESTA botella
- intimate: detalle íntimo verificable del lugar/proyecto ligado a personas

tellability (¿se puede contar en la mesa con hechos reales?):
- none: nada contable
- mild: un dato correcto pero flojo de gancho
- strong: anécdota o hecho que abre conversación
- magnetic: el dato que la gente repite (raro; requiere hecho concreto fuerte)

distinctiveness (¿es intercambiable o tiene ángulo propio?):
- commodity: genérico de supermercado / etiqueta sin carácter
- typical: tipicidad correcta de región/uva, sin ángulo propio
- distinct: estilo, uva, proyecto o ángulo propio claro
- rare: poco común / singular en contexto de cava personal

agingTier (señales de añejamiento de ESTA botella):
- none: sin dato
- entry: joven / sin crianza relevante
- aged: crianza/reserva/barrica u oak aging declarado
- reservaPlus: gran reserva / vieilles vignes / cru superior / reserva especial

### Reglas de consistencia (anti-ruido)
- Misma evidencia factual → MISMOS enums. No “re-opines” entre Actualizar; reclasifica solo si los HECHOS cambian.
- No regales fine/outstanding, rich, magnetic o rare sin hechos concretos nombrables.
- Si identity dudosa o sin señales → ratingEvidence null (y ratingParts null).
- Un Rating Cavatale guardado en la ficha es SOLO contexto histórico; NO lo uses para sesgar enums. Recalcula solo con evidencia actual.
- NUNCA menciones Vivino ni el score comunitario en summary/curiosity/talkHook/pairingNote.`;
