/**
 * Cavatale official score methodology (v3 — hybrid).
 *
 * Question answered: “¿Qué tan fuerte es esta botella como elección de cava
 * para abrir y contar algo verdadero — anclada al consenso público?”
 *
 * When a market consensus (Vivino / Wine-Searcher) is available:
 *   Mercado  50% — public community/critic consensus (1–5), exact SKU only
 *   Oficio   22% — craft of the line + aging signal
 *   Lugar    12% — place specificity + character
 *   Gente     9% — named humans / human link
 *   Mesa      7% — tellability at dinner
 *
 * Without market data, falls back to evidence-only (v2):
 *   Oficio 40% · Lugar 20% · Gente 20% · Mesa 20%
 *
 * LLM classifies evidence enums + cites; server sanitizes once after majority
 * vote and applies the fixed formula. Same evidence + same market → same score.
 * Stability comes from method agreement (×3 classify), not freezing scores.
 */

/** Judged axes; `market` is optional — present → hybrid weights. */
export type CavataleRatingParts = {
  /** Public consensus 1–5 (Vivino / WS-mapped). Omit/null → evidence-only. */
  market?: number | null;
  taste: number;
  story: number;
  table: number;
  originality: number;
};

/** Evidence-only weights (no public consensus). */
export const CAVATALE_RATING_WEIGHTS = {
  taste: 0.4,
  originality: 0.2,
  story: 0.2,
  table: 0.2,
} as const;

/** Hybrid weights when market consensus is present (exact SKU). */
export const CAVATALE_RATING_WEIGHTS_HYBRID = {
  market: 0.5,
  taste: 0.22,
  originality: 0.12,
  story: 0.09,
  table: 0.07,
} as const;

/** Snap to half-points 1.0–5.0 so component scores stay comparable across runs. */
export function snapHalfPoint(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const snapped = Math.round(value * 2) / 2;
  if (snapped < 1 || snapped > 5) return null;
  return snapped;
}

/** Market axis uses Vivino-style one-decimal precision (not half-points). */
export function snapMarketPoint(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const snapped = Math.round(value * 10) / 10;
  if (snapped < 1 || snapped > 5) return null;
  return snapped;
}

export function hasMarketConsensus(parts: CavataleRatingParts): boolean {
  const m = parts.market;
  return m != null && Number.isFinite(m) && m >= 1 && m <= 5;
}

/**
 * Attach (or strip) market consensus onto evidence axes.
 * Does not invent a score — null market → evidence-only formula.
 */
export function attachMarketConsensus(
  parts: CavataleRatingParts | null,
  market: number | null | undefined
): CavataleRatingParts | null {
  if (!parts) return null;
  const m = snapMarketPoint(market ?? null);
  return {
    taste: parts.taste,
    story: parts.story,
    table: parts.table,
    originality: parts.originality,
    market: m,
  };
}

/** Deterministic official score from axes (+ market when present). */
export function computeCavataleRatingFromParts(
  parts: CavataleRatingParts
): number {
  if (hasMarketConsensus(parts)) {
    const w = CAVATALE_RATING_WEIGHTS_HYBRID;
    const raw =
      (parts.market as number) * w.market +
      parts.taste * w.taste +
      parts.story * w.story +
      parts.table * w.table +
      parts.originality * w.originality;
    return Math.round(raw * 10) / 10;
  }
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
  const market = snapMarketPoint(
    asOptionalNumber(
      o.market ?? o.mercado ?? o.consensus ?? o.vivino ?? o.kimiVivino
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
  return { taste, story, table, originality, market };
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
  const parsed = parseCavataleEvidenceRaw(raw);
  if (!parsed) return null;
  return sanitizeCavataleEvidence(parsed.evidence, parsed.cites);
}

/**
 * Enums only — no cite-based sanitize.
 * Use for stored prior evidence (cites are not persisted) so reloads
 * do not invent fake axis distance vs a fresh classify.
 */
export function parseCavataleRatingEvidenceEnumsOnly(
  raw: unknown
): CavataleRatingEvidence | null {
  return parseCavataleEvidenceRaw(raw)?.evidence ?? null;
}

export type CavataleEvidenceParsed = {
  evidence: CavataleRatingEvidence;
  cites: CavataleRatingCites;
};

/** Parse enums + cites without sanitizing (sanitize once after majority). */
export function parseCavataleEvidenceRaw(
  raw: unknown
): CavataleEvidenceParsed | null {
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
    evidence: {
      craft,
      people,
      placeFacts,
      tellability,
      distinctiveness,
      agingTier,
    },
    cites: parseCavataleRatingCites(o),
  };
}

function pickBestCite(cites: string[]): string {
  let best = "";
  for (const c of cites) {
    const t = (c ?? "").trim();
    if (t.length > best.length) best = t;
  }
  return best;
}

/**
 * Majority on raw enums, then one sanitize with the strongest cites.
 * An axis only changes from prior when ≥2 independent samples agree.
 */
export function mergeEvidenceSamples(
  samples: CavataleEvidenceParsed[],
  prior?: CavataleRatingEvidence | null
): CavataleRatingEvidence | null {
  if (samples.length === 0) return null;
  const merged = mergeEvidenceMajority(
    samples.map((s) => s.evidence),
    prior
  );
  if (!merged) return null;
  const cites: CavataleRatingCites = {
    craftCite: pickBestCite(samples.map((s) => s.cites.craftCite)),
    peopleCite: pickBestCite(samples.map((s) => s.cites.peopleCite)),
    placeCite: pickBestCite(samples.map((s) => s.cites.placeCite)),
    tellCite: pickBestCite(samples.map((s) => s.cites.tellCite)),
    distinctCite: pickBestCite(samples.map((s) => s.cites.distinctCite)),
  };
  return sanitizeCavataleEvidence(merged, cites);
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

/**
 * When the ficha states crianza, trust it over an optimistic model enum.
 * Model may still fill when ficha has no aging signal.
 */
export function resolveAgingTierForScore(
  evidenceTier: AgingTier,
  fichaAging?: string | null
): AgingTier {
  const fromFicha = inferAgingTierFromFicha(fichaAging);
  if (fromFicha !== "none") return fromFicha;
  return evidenceTier;
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

/** Oficio = craft reputation/style clarity + aging signal (not palate fantasy). */
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
  if (e.craft === "fine" && e.agingTier === "reservaPlus") score += 0.5;
  return clampHalf(score);
}

/** Gente = named humans / human link only (place lives in Lugar). */
export function mapStoryAxis(e: CavataleRatingEvidence): number {
  const people: Record<PeopleLevel, number> = {
    none: 2.0,
    generic: 2.5,
    named: 3.5,
    rich: 4.5,
  };
  return clampHalf(people[e.people]);
}

/** Mesa = how tellable the real facts are at dinner (+ character lift). */
export function mapTableAxis(e: CavataleRatingEvidence): number {
  const base: Record<TellabilityLevel, number> = {
    none: 2.0,
    mild: 3.0,
    strong: 4.0,
    magnetic: 4.5,
  };
  let score = base[e.tellability];
  const peopleLift =
    (e.people === "named" || e.people === "rich") &&
    e.tellability !== "none";
  const characterLift =
    e.distinctiveness === "distinct" || e.distinctiveness === "rare";
  // One lift max — strong+named+distinct must not auto-cap at 5.0.
  if (peopleLift || characterLift) score += 0.5;
  return clampHalf(score);
}

/** Lugar = place specificity + distinctiveness vs commodity DO filler. */
export function mapOriginalityAxis(e: CavataleRatingEvidence): number {
  const place: Record<PlaceFactsLevel, number> = {
    none: 1.5,
    regionOnly: 2.5,
    bottleSpecific: 3.5,
    intimate: 4.5,
  };
  const characterAdj: Record<DistinctivenessLevel, number> = {
    commodity: -0.5,
    typical: 0,
    distinct: 0.5,
    rare: 1.0,
  };
  return clampHalf(place[e.placeFacts] + characterAdj[e.distinctiveness]);
}

/**
 * Map structured evidence → four half-point axes (deterministic).
 * Ficha aging text wins over model agingTier when present.
 */
export function computePartsFromEvidence(
  evidence: CavataleRatingEvidence,
  ficha?: { aging?: string | null }
): CavataleRatingParts | null {
  const agingTier = resolveAgingTierForScore(
    evidence.agingTier,
    ficha?.aging
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

export type CavataleAxisKey =
  | "market"
  | "taste"
  | "story"
  | "table"
  | "originality";

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
  if (hasMarketConsensus(parts)) {
    const w = CAVATALE_RATING_WEIGHTS_HYBRID;
    const keys: CavataleAxisKey[] = [
      "market",
      "taste",
      "originality",
      "story",
      "table",
    ];
    return keys.map((key) => {
      const weight = w[key];
      const score = parts[key] as number;
      return {
        key,
        score,
        weight,
        contribution: Math.round(score * weight * 10) / 10,
      };
    });
  }
  const keys: Array<"taste" | "originality" | "story" | "table"> = [
    "taste",
    "originality",
    "story",
    "table",
  ];
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

const CRAFT_RANK: Record<CraftLevel, number> = {
  unknown: 0,
  basic: 1,
  sound: 2,
  fine: 3,
  outstanding: 4,
};
const PEOPLE_RANK: Record<PeopleLevel, number> = {
  none: 0,
  generic: 1,
  named: 2,
  rich: 3,
};
const PLACE_RANK: Record<PlaceFactsLevel, number> = {
  none: 0,
  regionOnly: 1,
  bottleSpecific: 2,
  intimate: 3,
};
const TELL_RANK: Record<TellabilityLevel, number> = {
  none: 0,
  mild: 1,
  strong: 2,
  magnetic: 3,
};
const DISTINCT_RANK: Record<DistinctivenessLevel, number> = {
  commodity: 0,
  typical: 1,
  distinct: 2,
  rare: 3,
};

function pickLowerByRank<T extends string>(
  a: T,
  b: T,
  rank: Record<T, number>
): T {
  return rank[a] <= rank[b] ? a : b;
}

function majorityByRank<T extends string>(
  values: T[],
  rank: Record<T, number>
): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let maxCount = 0;
  for (const c of counts.values()) maxCount = Math.max(maxCount, c);
  const tied = [...counts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([k]) => k)
    .sort((a, b) => rank[a] - rank[b]);
  return tied[Math.floor((tied.length - 1) / 2)] ?? values[0];
}

/**
 * @deprecated Prefer mergeEvidenceMajority — always-low merge systematically underrates.
 */
export function mergeEvidenceConservative(
  a: CavataleRatingEvidence,
  b: CavataleRatingEvidence
): CavataleRatingEvidence {
  return {
    craft: pickLowerByRank(a.craft, b.craft, CRAFT_RANK),
    people: pickLowerByRank(a.people, b.people, PEOPLE_RANK),
    placeFacts: pickLowerByRank(a.placeFacts, b.placeFacts, PLACE_RANK),
    tellability: pickLowerByRank(a.tellability, b.tellability, TELL_RANK),
    distinctiveness: pickLowerByRank(
      a.distinctiveness,
      b.distinctiveness,
      DISTINCT_RANK
    ),
    agingTier: mergeAgingTier(a.agingTier, b.agingTier),
  };
}

/** Majority vote across independent classifications (precise + stable, no downward bias). */
export function mergeEvidenceMajority(
  samples: CavataleRatingEvidence[],
  prior?: CavataleRatingEvidence | null
): CavataleRatingEvidence | null {
  if (samples.length === 0) return null;
  if (samples.length === 1) return samples[0];

  function majorityPreferPrior<T extends string>(
    values: T[],
    rank: Record<T, number>,
    priorValue: T | undefined
  ): T {
    const counts = new Map<T, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let maxCount = 0;
    for (const c of counts.values()) maxCount = Math.max(maxCount, c);
    // Method exactness: an axis only moves when ≥2 samples agree.
    // Without agreement, keep prior if available (not a score freeze — samples disagreed).
    if (maxCount < 2 && priorValue != null) return priorValue;
    const tied = [...counts.entries()]
      .filter(([, c]) => c === maxCount)
      .map(([k]) => k);
    if (priorValue && tied.includes(priorValue)) return priorValue;
    tied.sort((a, b) => rank[a] - rank[b]);
    // Median of tied ranks (stable, less bias than always-low).
    return tied[Math.floor((tied.length - 1) / 2)] ?? values[0];
  }

  return {
    craft: majorityPreferPrior(
      samples.map((s) => s.craft),
      CRAFT_RANK,
      prior?.craft
    ),
    people: majorityPreferPrior(
      samples.map((s) => s.people),
      PEOPLE_RANK,
      prior?.people
    ),
    placeFacts: majorityPreferPrior(
      samples.map((s) => s.placeFacts),
      PLACE_RANK,
      prior?.placeFacts
    ),
    tellability: majorityPreferPrior(
      samples.map((s) => s.tellability),
      TELL_RANK,
      prior?.tellability
    ),
    distinctiveness: majorityPreferPrior(
      samples.map((s) => s.distinctiveness),
      DISTINCT_RANK,
      prior?.distinctiveness
    ),
    agingTier: samples.reduce(
      (acc, s) => mergeAgingTier(acc, s.agingTier),
      samples[0].agingTier
    ),
  };
}

function normId(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bumpFloor<T extends string>(
  value: T,
  floor: T,
  rank: Record<T, number>
): T {
  return rank[value] < rank[floor] ? floor : value;
}

function clampCeil<T extends string>(
  value: T,
  ceil: T,
  rank: Record<T, number>
): T {
  return rank[value] > rank[ceil] ? ceil : value;
}

/**
 * Deterministic floors/ceilings for well-known identities.
 * Stops entry lines of famous houses from oscillating fine↔sound / distinct↔typical.
 */
export function applyIdentityEvidenceAnchors(
  wine: {
    name?: string | null;
    winery?: string | null;
    region?: string | null;
  },
  evidence: CavataleRatingEvidence
): { evidence: CavataleRatingEvidence; anchored: boolean } {
  const name = normId(wine.name ?? "");
  const winery = normId(wine.winery ?? "");
  const region = normId(wine.region ?? "");
  const blob = `${name} ${winery}`;
  let e = { ...evidence };
  let anchored = false;

  const isEmilioMoro =
    /emilio\s*moro/.test(blob) || /emilio\s*moro/.test(winery);
  const isResalso = /finca\s*resalso|\bresalso\b/.test(name);
  const isMalleolus = /malleolus/.test(name);

  if (isEmilioMoro || isResalso || isMalleolus) {
    anchored = true;
    e.people = bumpFloor(e.people, "named", PEOPLE_RANK);
    if (/pesquera/.test(region)) {
      e.placeFacts = bumpFloor(e.placeFacts, "bottleSpecific", PLACE_RANK);
    } else {
      e.placeFacts = bumpFloor(e.placeFacts, "regionOnly", PLACE_RANK);
    }
    e.tellability = bumpFloor(e.tellability, "mild", TELL_RANK);

    if (isResalso) {
      // Entry / joven line of Emilio Moro — solid house, not icon craft.
      e.craft = bumpFloor(e.craft, "sound", CRAFT_RANK);
      e.craft = clampCeil(e.craft, "sound", CRAFT_RANK);
      e.distinctiveness = bumpFloor(e.distinctiveness, "typical", DISTINCT_RANK);
      e.distinctiveness = clampCeil(
        e.distinctiveness,
        "typical",
        DISTINCT_RANK
      );
      e.tellability = clampCeil(e.tellability, "strong", TELL_RANK);
    } else if (isMalleolus) {
      e.craft = bumpFloor(e.craft, "fine", CRAFT_RANK);
      e.craft = clampCeil(e.craft, "fine", CRAFT_RANK);
      e.distinctiveness = bumpFloor(
        e.distinctiveness,
        "distinct",
        DISTINCT_RANK
      );
    } else if (isEmilioMoro) {
      // Other Emilio Moro lines: at least sound/named; don't gift outstanding.
      e.craft = bumpFloor(e.craft, "sound", CRAFT_RANK);
      e.craft = clampCeil(e.craft, "fine", CRAFT_RANK);
      e.distinctiveness = clampCeil(
        e.distinctiveness,
        "distinct",
        DISTINCT_RANK
      );
    }
  }

  // Broad named-house floor (people only) — reduces none↔named flicker.
  if (
    /familia\s*torres|\bmiguel\s*torres\b|\bantinori\b|\bvega\s*sicilia\b|\bpingus\b|\bdominio\s*de\s*pingus\b|\ballegrini\b|\bcodorniu\b|\bfreixenet\b/.test(
      blob
    )
  ) {
    anchored = true;
    e.people = bumpFloor(e.people, "named", PEOPLE_RANK);
  }

  return { evidence: e, anchored };
}

/** How many evidence axes differ (0–6). */
export function evidenceAxisDistance(
  a: CavataleRatingEvidence,
  b: CavataleRatingEvidence
): number {
  let d = 0;
  if (a.craft !== b.craft) d += 1;
  if (a.people !== b.people) d += 1;
  if (a.placeFacts !== b.placeFacts) d += 1;
  if (a.tellability !== b.tellability) d += 1;
  if (a.distinctiveness !== b.distinctiveness) d += 1;
  if (a.agingTier !== b.agingTier) d += 1;
  return d;
}

/** Focused classify-only prompt (no narrative). Used for stable scoring. */
export const CAVATALE_EVIDENCE_CLASSIFY_PROMPT = `Eres el clasificador de evidencia Cavatale v3 (ejes Oficio/Lugar/Gente/Mesa). NO inventas el decimal: solo enums + citas cortas y VERACES.
El consenso de mercado (Vivino/Wine-Searcher) lo busca el servidor por separado — tú NO lo inventes ni lo copies aquí.
Pregunta del eje Cavatale: ¿qué tan fuerte es esta botella como elección de cava para abrir y contar algo verdadero?
IDENTIDAD: clasifica ESTA línea + crianza + uva + cosecha. Misma bodega ≠ misma craft/distinctiveness.
Si la ficha trae crianza (Joven/Crianza/Reserva…), agingTier debe alinearse a esa ficha — no infles a reservaPlus.
Misma botella + mismos hechos → MISMOS enums. Sé PRECISO (ni inflar ni castigar). Estabilidad > creatividad.

Devuelve SOLO JSON:
ratingEvidence {craft, people, placeFacts, tellability, distinctiveness, agingTier, craftCite, peopleCite, placeCite, tellCite, distinctCite}

### Anclas de calibración (OBLIGATORIAS)
1) Commodity / supermercado sin gente ni lugar propio (Faustino entry, Campo Viejo entry):
   craft=basic|sound, people=none|generic, placeFacts=regionOnly, tellability=mild|none, distinctiveness=commodity|typical.
2) Línea de ENTRADA de casa seria (ej. Finca Resalso / Emilio Moro joven-entry; Celeste entry):
   craft=sound (NO fine). people=named si la casa tiene nombre propio (Emilio Moro, Torres…).
   placeFacts=bottleSpecific solo con pueblo/viñedo citado (Pesquera…); si solo “Ribera” → regionOnly.
   tellability=mild|strong. distinctiveness=typical (NO distinct/rare: es la línea accesible).
3) Casa seria de DO con pueblo/milla de oro / viñedo propio + línea ALTA (Lleiroso Valbuena, Malleolus, iconos):
   craft=sound|fine según ESA línea. placeFacts=bottleSpecific con pueblo/paraje.
   people=named con fundador/familia. tellability=mild|strong. distinctiveness=typical|distinct.
4) Boutique íntima con parcela + vínculo humano rico: intimate/rich/magnetic solo con citas reales.
5) Prohibido: outstanding/rare por marketing; prohibido tratar Resalso/entry como fine+distinct; prohibido bajar a people=none una casa con nombre público.

### Consistencia
- Si hay evidencia previa y los hechos públicos no cambiaron, REUTILIZA los mismos enums.
- Corrige evidencia previa SOLO si omitió nombres o lugar concreto públicos, o si infló entry→fine.
- Citas: frases cortas factuales; "" solo si no hay hecho.`;

export const CAVATALE_EVIDENCE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    ratingEvidence: {
      type: "OBJECT",
      properties: {
        craft: {
          type: "STRING",
          enum: ["unknown", "basic", "sound", "fine", "outstanding"],
        },
        people: {
          type: "STRING",
          enum: ["none", "generic", "named", "rich"],
        },
        placeFacts: {
          type: "STRING",
          enum: ["none", "regionOnly", "bottleSpecific", "intimate"],
        },
        tellability: {
          type: "STRING",
          enum: ["none", "mild", "strong", "magnetic"],
        },
        distinctiveness: {
          type: "STRING",
          enum: ["commodity", "typical", "distinct", "rare"],
        },
        agingTier: {
          type: "STRING",
          enum: ["none", "entry", "aged", "reservaPlus"],
        },
        craftCite: { type: "STRING" },
        peopleCite: { type: "STRING" },
        placeCite: { type: "STRING" },
        tellCite: { type: "STRING" },
        distinctCite: { type: "STRING" },
      },
      required: [
        "craft",
        "people",
        "placeFacts",
        "tellability",
        "distinctiveness",
        "agingTier",
        "craftCite",
        "peopleCite",
        "placeCite",
        "tellCite",
        "distinctCite",
      ],
    },
  },
  required: ["ratingEvidence"],
};

/** Prompt block: explicit rubric + enum checklist (shared by research-wine). */
export const CAVATALE_RATING_RUBRIC_PROMPT = `## Rating Cavatale v3 — híbrido (reproducible)

Pregunta: ¿qué tan fuerte es esta botella como elección de cava para abrir y contar algo verdadero, anclada al consenso público?
NO es solo Vivino. NO es solo folklore. Es consenso de mercado + ADN Cavatale.

El SERVIDOR:
1) busca consenso público (Vivino 1–5 y/o Wine-Searcher 0–100) con web search,
2) baja enums sin cita suficiente,
3) calcula el total con pesos fijos:
   CON consenso: 50% Mercado · 22% Oficio · 12% Lugar · 9% Gente · 7% Mesa.
   SIN consenso: 40% Oficio · 20% Lugar · 20% Gente · 20% Mesa.

Devuelve OBLIGATORIAMENTE ratingEvidence si la identidad es clara.
NUNCA uses cavataleRating libre como fuente de verdad.
El campo vivino es estimación secundaria; el consenso oficial lo fija el servidor.
Si hay crianza en ficha, agingTier debe respetarla (Joven→entry; Crianza/Reserva→aged; Gran Reserva→reservaPlus).
No trates dos variantes de la misma casa como el mismo vino.

### ratingEvidence — enums + citas

Incluye SIEMPRE: craftCite, peopleCite, placeCite, tellCite, distinctCite ("" si no hay hecho).

craft: unknown / basic / sound / fine / outstanding
- fine = reputación clara de calidad de ESA línea (alta gama Ribera/Valbuena cuenta).
- outstanding casi nunca (icono de categoría).

people: none / generic / named / rich
- named exige nombre propio real (fundador, familia, enólogo).

placeFacts: none / regionOnly / bottleSpecific / intimate
- bottleSpecific si hay pueblo (Valbuena), milla de oro, viñedo propio, paraje — NO basta “Ribera del Duero” genérica.

tellability: none / mild / strong / magnetic
distinctiveness: commodity / typical / distinct / rare
agingTier: none / entry / aged / reservaPlus

### Anti-inflado y anti-castigo
- Sin cita → el servidor degrada. No inventes citas.
- Misma evidencia → mismos enums.
- No regales outstanding/rich/magnetic/rare.
- Línea de entrada de casa seria (Finca Resalso / Emilio Moro entry): craft=sound, distinctiveness=typical, people=named. NO fine+distinct.
- No trates como commodity una bodega seria de pueblo/milla de oro con proyecto real.
- Casa con fundador público → people=named con cita.
- Si la evidencia previa ya era precisa y los hechos no cambiaron → mismos enums (estabilidad).
- NUNCA menciones Vivino en summary/curiosity/talkHook/pairingNote.`;
