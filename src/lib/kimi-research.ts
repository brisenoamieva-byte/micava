import type { MatchConfidence, Wine } from "@/lib/types";
import { extractJsonObject } from "@/lib/scan-label";
import {
  computeCavataleRatingFromParts,
  computePartsFromEvidence,
  parseCavataleRatingEvidence,
  parseCavataleRatingParts,
  type CavataleRatingEvidence,
  type CavataleRatingParts,
} from "@/lib/cavatale-rating";

export type {
  CavataleRatingEvidence,
  CavataleRatingParts,
} from "@/lib/cavatale-rating";
export {
  CAVATALE_RATING_WEIGHTS,
  computeCavataleRatingFromParts,
  computeOfficialFromEvidence,
  computePartsFromEvidence,
  parseCavataleRatingEvidence,
  parseCavataleRatingParts,
  snapHalfPoint,
  CAVATALE_RATING_RUBRIC_PROMPT,
} from "@/lib/cavatale-rating";

export type KimiResearch = {
  /** Official Cavatale rating 1–5 (primary). */
  cavataleRating: number | null;
  kimiVivino: number | null;
  kimiPrice: number | null;
  /** ISO 4217 for kimiPrice; null → treat as MXN. */
  kimiPriceCurrency?: string | null;
  kimiSummary: string | null;
  kimiCuriosity: string | null;
  kimiTalkHook: string | null;
  /** AI dishes tailored to this bottle. */
  kimiPairings: string[] | null;
  /** One-line why these dishes fit. */
  kimiPairingNote: string | null;
  kimiCheckedAt: string | null;
  kimiConfidence: MatchConfidence | null;
};

export const emptyKimiResearch: KimiResearch = {
  cavataleRating: null,
  kimiVivino: null,
  kimiPrice: null,
  kimiPriceCurrency: null,
  kimiSummary: null,
  kimiCuriosity: null,
  kimiTalkHook: null,
  kimiPairings: null,
  kimiPairingNote: null,
  kimiCheckedAt: null,
  kimiConfidence: null,
};

/**
 * Prefer a fresh research score when present; keep the stored one only as
 * fallback so a thin/failed pass never wipes an existing rating with null.
 */
export function stabilizeCavataleRating(
  existing: number | null | undefined,
  incoming: number | null | undefined,
  /** @deprecated Ignored — kept for call-site compatibility. */
  _opts?: { forceRecalculate?: boolean; maxStep?: number }
): number | null {
  if (incoming != null && Number.isFinite(incoming)) {
    const next = Math.round(incoming * 10) / 10;
    if (next >= 1 && next <= 5) return next;
  }
  if (existing != null && Number.isFinite(existing)) {
    const kept = Math.round(existing * 10) / 10;
    if (kept >= 1 && kept <= 5) return kept;
  }
  return null;
}

/**
 * Official score: evidence→parts (caller) only.
 * Free-form LLM decimals are ignored — they caused inflated first-pass scores.
 * If parts missing, keep existing (do not invent a float).
 */
export function resolveOfficialCavataleRating(options: {
  existing?: number | null;
  /** @deprecated Ignored. */
  lockExisting?: boolean;
  /** @deprecated Ignored. */
  forceRecalculate?: boolean;
  parts?: CavataleRatingParts | null;
  /** @deprecated Ignored — free LLM floats are not official. */
  modelRating?: number | null;
  maxStep?: number;
}): number | null {
  const fromParts = options.parts
    ? computeCavataleRatingFromParts(options.parts)
    : null;
  return stabilizeCavataleRating(options.existing, fromParts);
}

export function withKimiDefaults<T extends Partial<Wine>>(
  wine: T
): T &
  KimiResearch & {
    labelImageUrl: string | null;
    cavataleRating: number | null;
    kimiUserNote: string | null;
    priceCurrency: string | null;
    kimiPriceCurrency: string | null;
  } {
  return {
    ...wine,
    labelImageUrl: wine.labelImageUrl ?? null,
    cavataleRating: wine.cavataleRating ?? null,
    priceCurrency: wine.priceCurrency ?? null,
    kimiVivino: wine.kimiVivino ?? null,
    kimiPrice: wine.kimiPrice ?? null,
    kimiPriceCurrency: wine.kimiPriceCurrency ?? null,
    kimiSummary: wine.kimiSummary ?? null,
    kimiCuriosity: wine.kimiCuriosity ?? null,
    kimiTalkHook: wine.kimiTalkHook ?? null,
    kimiPairings: wine.kimiPairings ?? null,
    kimiPairingNote: wine.kimiPairingNote ?? null,
    kimiCheckedAt: wine.kimiCheckedAt ?? null,
    kimiConfidence: wine.kimiConfidence ?? null,
    kimiUserNote: wine.kimiUserNote ?? null,
  };
}

const MAX_USER_CORRECTION_CHARS = 500;
const MIN_USER_CORRECTION_CHARS = 12;

const VAGUE_CORRECTION_RE =
  /^(está?\s*mal|incorrect[oa]|error|mal|no|wrong|falso|mentira)([.!…¿?¡\s]*)$/i;

const FABRICATE_CORRECTION_RE =
  /\b(inventa|inventen|inventar|haz\s+de\s+cuenta|finge|finjan|escribe\s+que|pon\s+que|crea\s+una\s+historia|imagina\s+que|invent[aeá]|biograf[ií]a\s+a\s+pedido)\b/i;

export type UserCorrectionCheck =
  | { ok: true; note: string }
  | { ok: false; error: string };

/** Validate owner dispute note before sending to research. */
export function normalizeUserCorrectionNote(
  raw: string | null | undefined
): UserCorrectionCheck {
  const note = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!note) {
    return {
      ok: false,
      error: "Escribe qué dato concreto está mal.",
    };
  }
  if (note.length < MIN_USER_CORRECTION_CHARS) {
    return {
      ok: false,
      error: "Sé más concreto: bodega, persona, región u otro dato puntual.",
    };
  }
  if (note.length > MAX_USER_CORRECTION_CHARS) {
    return {
      ok: false,
      error: `Máximo ${MAX_USER_CORRECTION_CHARS} caracteres.`,
    };
  }
  if (VAGUE_CORRECTION_RE.test(note)) {
    return {
      ok: false,
      error: "Indica el dato concreto que está mal (no solo “está mal”).",
    };
  }
  if (FABRICATE_CORRECTION_RE.test(note)) {
    return {
      ok: false,
      error:
        "No pedimos inventar biografías. Señala un error factual verificable.",
    };
  }
  return { ok: true, note };
}

/**
 * Prompt block: owner note is a contested claim, never ground truth.
 * Returns empty string if note is empty/invalid (caller should validate first).
 */
export function buildUserCorrectionPromptBlock(note: string): string {
  const checked = normalizeUserCorrectionNote(note);
  if (!checked.ok) return "";
  return `

REVISIÓN SOLICITADA POR EL DUEÑO DE LA BOTELLA (NO es verdad automática):
«${checked.note}»

Trátalo como una reclamación/disputa a contrastar — NO como hecho confirmado ni como instrucción para reescribir la historia a gusto:
- Verifica contra lo que sí sepas de ESTA botella/bodega. Si el reclamo parece correcto y verificable, corrige el error.
- Si no puedes verificarlo, dilo con naturalidad en el relato (o omite el dato dudoso); no lo presentes como certeza.
- NUNCA inventes personas, fechas, premios, anécdotas ni biografías para “cumplir” la nota.
- No reescribas la historia solo para agradar: prioriza hechos conocidos y honestidad.
- Devuelve el JSON completo otra vez.`;
}

function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function clampScore(value: number | null): number | null {
  if (value == null) return null;
  const n = Math.round(value * 10) / 10;
  if (n < 1 || n > 5) return null;
  return n;
}

function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

function asStringList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const list = value
      .map((item) => asString(item))
      .filter(Boolean)
      .slice(0, 8);
    return list.length > 0 ? list : null;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return asStringList(parsed);
    } catch {
      /* fall through */
    }
    const list = value
      .split(/\n|;|·|\|/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    return list.length > 0 ? list : null;
  }
  return null;
}

/** Persist pairings blob for text column. */
export function serializeKimiPairings(
  dishes: string[] | null,
  note: string | null
): string | null {
  if (!dishes?.length && !note) return null;
  return JSON.stringify({
    dishes: dishes ?? [],
    note: note ?? "",
  });
}

export function parseKimiPairingsBlob(
  raw: string | null | undefined
): { dishes: string[] | null; note: string | null } {
  if (!raw?.trim()) return { dishes: null, note: null };
  try {
    const o = JSON.parse(raw) as { dishes?: unknown; note?: unknown };
    return {
      dishes: asStringList(o.dishes),
      note: asString(o.note) || null,
    };
  } catch {
    return { dishes: asStringList(raw), note: null };
  }
}

export function parseKimiResearchPayload(raw: unknown): Omit<
  KimiResearch,
  "kimiCheckedAt"
> & {
  ratingParts: CavataleRatingParts | null;
  ratingEvidence: CavataleRatingEvidence | null;
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("Respuesta de investigación inválida.");
  }
  const o = raw as Record<string, unknown>;

  const ratingEvidence = parseCavataleRatingEvidence(
    o.ratingEvidence ?? o.evidence ?? o.cavataleEvidence
  );
  const legacyParts = parseCavataleRatingParts(
    o.ratingParts ?? o.cavataleParts ?? o.scores ?? o.rating_parts
  );
  // Prefer code-mapped axes from structured (+ sanitized) evidence.
  // Never trust free-form cavataleRating floats — they inflate first passes.
  const ratingParts =
    (ratingEvidence
      ? computePartsFromEvidence(ratingEvidence)
      : null) ?? legacyParts;
  const fromParts = ratingParts
    ? computeCavataleRatingFromParts(ratingParts)
    : null;
  const cavataleRating = fromParts;

  let kimiVivino = clampScore(
    asOptionalNumber(o.vivino ?? o.kimiVivino ?? o.vivinoEstimate)
  );

  let kimiPrice = asOptionalNumber(o.price ?? o.kimiPrice);
  if (kimiPrice != null) {
    kimiPrice = Math.round(kimiPrice);
    if (kimiPrice <= 0 || kimiPrice > 1_000_000) kimiPrice = null;
  }

  const confRaw = asString(o.confidence ?? o.kimiConfidence).toLowerCase();
  const mapped: MatchConfidence | null =
    confRaw === "high" || confRaw === "confirmed"
      ? "confirmed"
      : confRaw === "medium" || confRaw === "likely"
        ? "likely"
        : confRaw === "low" || confRaw === "uncertain"
          ? "uncertain"
          : null;

  return {
    cavataleRating,
    ratingParts,
    ratingEvidence,
    kimiVivino,
    kimiPrice,
    kimiSummary: asString(o.summary ?? o.notes ?? o.kimiSummary) || null,
    kimiCuriosity:
      asString(o.curiosity ?? o.kimiCuriosity ?? o.dato_curioso) || null,
    kimiTalkHook:
      asString(
        o.talkHook ?? o.talk_hook ?? o.kimiTalkHook ?? o.conversation
      ) || null,
    kimiPairings: asStringList(
      o.pairings ?? o.dishes ?? o.kimiPairings ?? o.maridaje
    ),
    kimiPairingNote:
      asString(
        o.pairingNote ?? o.pairing_note ?? o.kimiPairingNote ?? o.maridajeNota
      ) || null,
    kimiConfidence: mapped,
  };
}

export function parseKimiResearchFromModelText(text: string): Omit<
  KimiResearch,
  "kimiCheckedAt"
> & {
  ratingParts: CavataleRatingParts | null;
  ratingEvidence: CavataleRatingEvidence | null;
} {
  return parseKimiResearchPayload(extractJsonObject(text));
}

export function wineIdentityForResearch(wine: Pick<
  Wine,
  | "name"
  | "winery"
  | "country"
  | "region"
  | "type"
  | "grape"
  | "aging"
  | "vintage"
  | "vivino"
  | "cavataleRating"
  | "price"
>): string {
  return [
    `Nombre: ${wine.name}`,
    `Bodega: ${wine.winery || "—"}`,
    `País: ${wine.country || "—"}`,
    `Región: ${wine.region || "—"}`,
    `Tipo: ${wine.type || "—"}`,
    `Uva: ${wine.grape || "—"}`,
    `Añejamiento: ${wine.aging || "—"}`,
    `Año: ${wine.vintage ?? "—"}`,
    `Vivino (comunidad) guardado: ${wine.vivino ?? "sin dato"}`,
    `Rating Cavatale guardado (histórico; no sesga el score): ${wine.cavataleRating ?? "sin dato"}`,
    `Precio guardado en Cavatale (MXN): ${wine.price ?? "sin dato"}`,
  ].join("\n");
}

/** Catalog / appellation filler openings — reject or retry. */
const GENERIC_OPENING =
  /^(esta\s+botella\s+es\s+|este\s+vino\s+es\s+|)?(.{0,40})?(es\s+una\s+de\s+las\s+(denominaciones|regiones|bodegas|zonas)\s+m[aá]s|pertenece\s+a\s+la\s+(d\.?\s?o\.?|denominaci[oó]n)|se\s+elabora\s+en\s+la\s+regi[oó]n|conocido\s+por\s+sus\s+(vinos|uvas|tintos)|la\s+denominaci[oó]n\s+de\s+origen|en\s+el\s+coraz[oó]n\s+de\s+(la\s+)?(rioja|ribera|burgundy|borgo[nñ]a|champagne|mendoza|napa)|es\s+un\s+vino\s+(tinto|blanco|rosado|espumoso)\s+(de|con|elaborado)|representa\s+(la|el)\s+(esencia|expresi[oó]n|tradici[oó]n)\s+de)/i;

const EMPTY_WINE_SPEAK =
  /\b(equilibrio\s+perfecto|excelente\s+relaci[oó]n\s+calidad[- ]precio|notas\s+de\s+(fruta\s+roja|frutos\s+rojos|cereza|vainilla)\s+y\s+(especias|roble|madera)|final\s+(largo|persistente|elegante)\s+y\s+(sedoso|aterciopelado)|tipicidad\s+(de\s+la\s+zona|varietal)|expresi[oó]n\s+pura\s+del\s+terroir|experiencia\s+sensorial\s+[uú]nica)\b/i;

const FLUFF_PREFIX =
  /^(vale\s+la\s+pena\s+saber\s+que\s+|lo\s+interesante\s+es\s+que\s+|hay\s+que\s+decir\s+que\s+|sin\s+duda\s+|en\s+definitiva\s+|como\s+es\s+bien\s+sabido\s+|tradicionalmente\s+se\s+dice\s+que\s+)/i;

function significantTokens(text: string): Set<string> {
  const stop = new Set([
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "un",
    "una",
    "y",
    "o",
    "en",
    "con",
    "por",
    "para",
    "que",
    "se",
    "su",
    "sus",
    "al",
    "es",
    "este",
    "esta",
    "vino",
    "botella",
    "bodega",
  ]);
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9áéíóúñü]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length > 3 && !stop.has(t))
  );
}

function overlapRatio(a: string, b: string): number {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}

function trimNarrativeFluff(text: string | null): string | null {
  if (!text) return null;
  let t = text.trim().replace(/\s+/g, " ");
  t = t.replace(FLUFF_PREFIX, "");
  // Drop leading generic DO clause if followed by a real sentence.
  t = t.replace(
    /^(es\s+una\s+de\s+las\s+[^.!?]{10,80}[.!?]\s*)/i,
    ""
  );
  t = t.trim();
  return t || null;
}

export type StoryQuality = {
  /** Thin or catalog-like; UI may hint to retry. */
  thin: boolean;
  /** Worth one model retry (generic opening / empty speak / missing core). */
  shouldRetry: boolean;
};

/**
 * Light quality gate for Contar historia narratives.
 * Does not invent content — only flags / trims fluff.
 */
export function assessKimiStoryQuality(
  research: Pick<
    KimiResearch,
    "kimiSummary" | "kimiCuriosity" | "kimiTalkHook" | "kimiConfidence"
  >
): StoryQuality {
  const summary = research.kimiSummary?.trim() ?? "";
  const curiosity = research.kimiCuriosity?.trim() ?? "";
  const hook = research.kimiTalkHook?.trim() ?? "";

  const missingCore = !summary || summary.length < 80;
  const genericOpen = summary ? GENERIC_OPENING.test(summary) : false;
  const wineSpeak = summary ? EMPTY_WINE_SPEAK.test(summary) : false;
  const thinCuriosity = !curiosity || curiosity.length < 28;
  const thinHook = !hook || hook.length < 18;
  const repeated =
    (summary && curiosity && overlapRatio(summary, curiosity) >= 0.55) ||
    (summary && hook && overlapRatio(summary, hook) >= 0.55) ||
    (curiosity && hook && overlapRatio(curiosity, hook) >= 0.6);

  const shouldRetry =
    missingCore || genericOpen || wineSpeak || (thinCuriosity && thinHook);

  const thin =
    shouldRetry ||
    thinCuriosity ||
    thinHook ||
    repeated ||
    research.kimiConfidence === "uncertain";

  return { thin, shouldRetry };
}

/** Soft polish after parse — never invents facts. */
export function polishKimiResearchNarratives<
  T extends Pick<
    KimiResearch,
    | "kimiSummary"
    | "kimiCuriosity"
    | "kimiTalkHook"
    | "kimiPairingNote"
    | "kimiPairings"
  >,
>(research: T): T {
  return {
    ...research,
    kimiSummary: trimNarrativeFluff(research.kimiSummary),
    kimiCuriosity: trimNarrativeFluff(research.kimiCuriosity),
    kimiTalkHook: trimNarrativeFluff(research.kimiTalkHook),
    kimiPairingNote: trimNarrativeFluff(research.kimiPairingNote),
    kimiPairings: research.kimiPairings
      ? research.kimiPairings
          .map((d) => d.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .slice(0, 8)
      : null,
  };
}

/** True when the bottle story is worth a quiet "Actualizar" nudge. */
export function isThinKimiStory(
  wine: Pick<
    Wine,
    "kimiSummary" | "kimiCuriosity" | "kimiTalkHook" | "kimiConfidence"
  >
): boolean {
  if (!wine.kimiSummary && !wine.kimiCuriosity && !wine.kimiTalkHook) {
    return false;
  }
  return assessKimiStoryQuality({
    kimiSummary: wine.kimiSummary,
    kimiCuriosity: wine.kimiCuriosity,
    kimiTalkHook: wine.kimiTalkHook,
    kimiConfidence: wine.kimiConfidence,
  }).thin;
}
