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

/** Concrete citations that justify high enums (anti-inflation). */
export type CavataleRatingCites = {
  craftCite: string;
  peopleCite: string;
  placeCite: string;
  tellCite: string;
  distinctCite: string;
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

function asCite(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, 240);
}

function citeHasSubstance(cite: string, minLen = 12): boolean {
  return cite.replace(/\s/g, "").length >= minLen;
}

/** Proper-name signal: at least one Capitalized token ≥2 letters. */
function citeHasProperName(cite: string): boolean {
  if (!cite.trim()) return false;
  return /(?:^|[\s,./(«"'])[\p{Lu}][\p{L}'’-]{1,}/u.test(cite);
}

function citeHasHumanLink(cite: string): boolean {
  const c = cite
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /padre|madre|hijo|hija|familia|fund|herencia|generacion|esposa|esposo|nieto|abuelo|duo|pareja|sucesor|founder|family|son|daughter|heir/.test(
    c
  );
}

function citeHasPlaceSpecifics(cite: string): boolean {
  const c = cite
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (
    /vineyard|vineedo|vina|parcela|pago|finca|pueblo|aldea|single\s*vineyard|lieu-?dit|cru|terroir\s+de/.test(
      c
    )
  ) {
    return true;
  }
  // Generic DO-only cites don't count as bottle-specific.
  if (
    /^(ribera(\s+del\s+duero)?|rioja|priorat|mendoza|valle de guadalupe|bordeaux|burgundy|toscana|chianti)[\s.]*$/i.test(
      cite.trim()
    )
  ) {
    return false;
  }
  return citeHasSubstance(cite, 18);
}

function citeSupportsOutstanding(cite: string): boolean {
  const c = cite
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /icono|referencia|benchmark|grand\s*cru|primera\s*linea|cult|legendary|benchmark|world[- ]class|mejor\s+de/.test(
    c
  );
}

export function parseCavataleRatingCites(raw: unknown): CavataleRatingCites {
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    craftCite: asCite(o.craftCite ?? o.craft_cite ?? o.craftJustification),
    peopleCite: asCite(
      o.peopleCite ?? o.people_cite ?? o.peopleJustification ?? o.personas
    ),
    placeCite: asCite(o.placeCite ?? o.place_cite ?? o.placeJustification),
    tellCite: asCite(
      o.tellCite ?? o.tell_cite ?? o.tellabilityCite ?? o.mesaCite
    ),
    distinctCite: asCite(
      o.distinctCite ?? o.distinct_cite ?? o.originalityCite
    ),
  };
}

/**
 * Downgrade optimistic enums that lack concrete citations.
 * Same bottle + same real facts → same sanitized evidence → same score.
 */
export function sanitizeCavataleEvidence(
  evidence: CavataleRatingEvidence,
  cites: CavataleRatingCites
): CavataleRatingEvidence {
  let { craft, people, placeFacts, tellability, distinctiveness, agingTier } =
    evidence;

  if (craft === "outstanding" && !citeSupportsOutstanding(cites.craftCite)) {
    craft = citeHasSubstance(cites.craftCite, 15) ? "fine" : "sound";
  }
  if (craft === "fine" && !citeHasSubstance(cites.craftCite, 15)) {
    craft = "sound";
  }

  if (people === "rich") {
    if (!citeHasProperName(cites.peopleCite)) {
      people = citeHasSubstance(cites.peopleCite, 8) ? "generic" : "none";
    } else if (!citeHasHumanLink(cites.peopleCite)) {
      people = "named";
    }
  } else if (people === "named" && !citeHasProperName(cites.peopleCite)) {
    people = citeHasSubstance(cites.peopleCite, 8) ? "generic" : "none";
  }

  if (
    (placeFacts === "bottleSpecific" || placeFacts === "intimate") &&
    !citeHasPlaceSpecifics(cites.placeCite)
  ) {
    placeFacts = citeHasSubstance(cites.placeCite, 8) ? "regionOnly" : "none";
  }
  if (placeFacts === "intimate" && !citeHasHumanLink(cites.placeCite)) {
    placeFacts = "bottleSpecific";
  }

  if (tellability === "magnetic" && !citeHasSubstance(cites.tellCite, 28)) {
    tellability = citeHasSubstance(cites.tellCite, 16) ? "strong" : "mild";
  }
  if (tellability === "strong" && !citeHasSubstance(cites.tellCite, 16)) {
    tellability = citeHasSubstance(cites.tellCite, 8) ? "mild" : "none";
  }

  if (distinctiveness === "rare" && !citeHasSubstance(cites.distinctCite, 20)) {
    distinctiveness = citeHasSubstance(cites.distinctCite, 12)
      ? "distinct"
      : "typical";
  }
  if (
    distinctiveness === "distinct" &&
    !citeHasSubstance(cites.distinctCite, 12)
  ) {
    distinctiveness = "typical";
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
  const cites = parseCavataleRatingCites(o);
  return sanitizeCavataleEvidence(
    {
      craft,
      people,
      placeFacts,
      tellability,
      distinctiveness,
      agingTier,
    },
    cites
  );
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

export type CavataleAxisKey = keyof CavataleRatingParts;

export type CavataleAxisBreakdownRow = {
  key: CavataleAxisKey;
  score: number;
  weight: number;
  contribution: number;
};

/** Rows for UI: axis score × weight → contribution to total. */
export function buildCavataleAxisBreakdown(
  parts: CavataleRatingParts
): CavataleAxisBreakdownRow[] {
  const keys: CavataleAxisKey[] = ["taste", "story", "table", "originality"];
  return keys.map((key) => {
    const weight = CAVATALE_RATING_WEIGHTS[key];
    const score = parts[key];
    return {
      key,
      score,
      weight,
      contribution: Math.round(score * weight * 10) / 10,
    };
  });
}

export type CavataleEvidenceKey = keyof CavataleRatingEvidence;

export const CAVATALE_EVIDENCE_KEYS: CavataleEvidenceKey[] = [
  "craft",
  "people",
  "placeFacts",
  "tellability",
  "distinctiveness",
  "agingTier",
];

/** Prompt block: explicit rubric + enum checklist (shared by research-wine). */
export const CAVATALE_RATING_RUBRIC_PROMPT = `## Rating Cavatale — metodología fija (reproducible)

El score oficial NO es un decimal inventado. Clasifica EVIDENCIA en enums + CITAS; el SERVIDOR:
1) baja enums sin cita suficiente,
2) calcula ejes y el total con pesos fijos 0.30*taste + 0.30*story + 0.25*table + 0.15*originality.

Devuelve OBLIGATORIAMENTE ratingEvidence (objeto) si la identidad es clara.
ratingParts es opcional (legado). NUNCA uses cavataleRating libre como fuente de verdad: el servidor lo ignora si hay evidencia.

### ratingEvidence — enums + citas (citas OBLIGATORIAS para niveles altos)

Incluye SIEMPRE estas claves de cita (string; "" si no hay hecho):
craftCite, peopleCite, placeCite, tellCite, distinctCite.

craft (calidad/reputación de ESTA botella/línea — no tu gusto):
- unknown / basic / sound / fine / outstanding
- fine exige craftCite con señal concreta (≥~15 chars). outstanding casi nunca; exige señal de icono/referencia.

people:
- none / generic / named / rich
- named exige peopleCite con NOMBRE PROPIO real. rich exige además vínculo humano (padre/hijo, herencia, fundación…).

placeFacts:
- none / regionOnly / bottleSpecific / intimate
- bottleSpecific/intimate exigen placeCite con viñedo/pueblo/parcela/sitio — NO basta “Ribera del Duero” / DO genérica.

tellability:
- none / mild / strong / magnetic
- strong/magnetic exigen tellCite con el hecho contable (no marketing vacío).

distinctiveness:
- commodity / typical / distinct / rare
- distinct/rare exigen distinctCite con el ángulo propio. Un Reserva tipico de DO → typical (no distinct).

agingTier:
- none / entry / aged / reservaPlus

### Reglas anti-inflado (críticas)
- Sin cita suficiente el SERVIDOR degrada el enum. No inventes citas.
- Misma evidencia factual → MISMOS enums y MISMAS citas entre Actualizar.
- No regales fine/outstanding, rich, magnetic o rare.
- Un Reserva comercial tipico de Ribera/Rioja con poca gente nombrable suele ser: craft=sound, people=none|generic, placeFacts=regionOnly, tellability=mild, distinctiveness=typical, agingTier=aged.
- Si identity dudosa → ratingEvidence null.
- Rating guardado en ficha = contexto histórico; NO sesgues enums hacia él. Recalcula solo con hechos actuales.
- NUNCA menciones Vivino ni el score comunitario en summary/curiosity/talkHook/pairingNote.`;
