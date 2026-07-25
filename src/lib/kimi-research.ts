import type { MatchConfidence, Wine } from "@/lib/types";
import { extractJsonObject } from "@/lib/scan-label";

export type KimiResearch = {
  /** Official Cavatale rating 1–5 (primary). */
  cavataleRating: number | null;
  kimiVivino: number | null;
  kimiPrice: number | null;
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
  kimiSummary: null,
  kimiCuriosity: null,
  kimiTalkHook: null,
  kimiPairings: null,
  kimiPairingNote: null,
  kimiCheckedAt: null,
  kimiConfidence: null,
};

export function withKimiDefaults<T extends Partial<Wine>>(
  wine: T
): T &
  KimiResearch & {
    labelImageUrl: string | null;
    cavataleRating: number | null;
  } {
  return {
    ...wine,
    labelImageUrl: wine.labelImageUrl ?? null,
    cavataleRating: wine.cavataleRating ?? null,
    kimiVivino: wine.kimiVivino ?? null,
    kimiPrice: wine.kimiPrice ?? null,
    kimiSummary: wine.kimiSummary ?? null,
    kimiCuriosity: wine.kimiCuriosity ?? null,
    kimiTalkHook: wine.kimiTalkHook ?? null,
    kimiPairings: wine.kimiPairings ?? null,
    kimiPairingNote: wine.kimiPairingNote ?? null,
    kimiCheckedAt: wine.kimiCheckedAt ?? null,
    kimiConfidence: wine.kimiConfidence ?? null,
  };
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
> {
  if (!raw || typeof raw !== "object") {
    throw new Error("Respuesta de investigación inválida.");
  }
  const o = raw as Record<string, unknown>;

  const cavataleRating = clampScore(
    asOptionalNumber(
      o.cavataleRating ?? o.cavatale_rating ?? o.ratingCavatale
    )
  );

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
> {
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
    `Rating Cavatale guardado: ${wine.cavataleRating ?? "sin dato"}`,
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
