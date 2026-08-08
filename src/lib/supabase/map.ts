import type {
  CellarLogEntry,
  CellarUnit,
  DepartAction,
  Encounter,
  Wine,
} from "@/lib/types";
import {
  parseKimiPairingsBlob,
  serializeKimiPairings,
  withKimiDefaults,
} from "@/lib/kimi-research";
import {
  parseCavataleRatingEvidence,
  parseCavataleRatingParts,
} from "@/lib/cavatale-rating";
import { withVerificationDefaults } from "@/lib/rating-verify";

export type WineRow = {
  id: string;
  user_id: string;
  cellar_id: string | null;
  slot: string | null;
  col: number | null;
  row: string | null;
  country: string;
  region: string;
  type: string;
  winery: string;
  name: string;
  aging: string;
  grape: string;
  vintage: number | null;
  vivino: number | null;
  cavatale_rating: number | null;
  cavatale_parts?: unknown;
  cavatale_evidence?: unknown;
  price: number | null;
  price_currency?: string | null;
  external_rating: number | null;
  rating_source: string | null;
  last_checked_at: string | null;
  match_confidence: string | null;
  kimi_vivino: number | null;
  kimi_price: number | null;
  kimi_price_currency?: string | null;
  kimi_summary: string | null;
  kimi_curiosity: string | null;
  kimi_talk_hook: string | null;
  kimi_pairings: string | null;
  kimi_checked_at: string | null;
  kimi_confidence: string | null;
  kimi_user_note: string | null;
  label_image_url: string | null;
};

export type HistoryRow = {
  id: string;
  user_id: string;
  at: string;
  action: DepartAction;
  /** Wine snapshot; may also carry myRating/note for taste memory. */
  wine: CellarLogEntry["wine"] & {
    myRating?: number | null;
    note?: string | null;
  };
};

export type CellarRow = {
  id: string;
  user_id: string;
  name: string;
  cols: number;
  rows: string[];
  sort_order: number;
};

export function wineFromRow(row: WineRow): Wine {
  const pairings = parseKimiPairingsBlob(row.kimi_pairings);
  return withKimiDefaults(
    withVerificationDefaults({
      id: row.id,
      cellarId: row.cellar_id ?? null,
      slot: row.slot,
      col: row.col,
      row: row.row,
      country: row.country ?? "",
      region: row.region ?? "",
      type: row.type ?? "Tinto",
      winery: row.winery ?? "",
      name: row.name ?? "",
      aging: row.aging ?? "",
      grape: row.grape ?? "",
      vintage: row.vintage,
      vivino: row.vivino,
      cavataleRating: row.cavatale_rating ?? null,
      cavataleParts: parseCavataleRatingParts(row.cavatale_parts),
      cavataleEvidence: parseCavataleRatingEvidence(row.cavatale_evidence),
      price: row.price,
      priceCurrency: row.price_currency ?? null,
      externalRating: row.external_rating,
      ratingSource: row.rating_source as Wine["ratingSource"],
      lastCheckedAt: row.last_checked_at,
      matchConfidence: row.match_confidence as Wine["matchConfidence"],
      kimiVivino: row.kimi_vivino ?? null,
      kimiPrice: row.kimi_price ?? null,
      kimiPriceCurrency: row.kimi_price_currency ?? null,
      kimiSummary: row.kimi_summary ?? null,
      kimiCuriosity: row.kimi_curiosity ?? null,
      kimiTalkHook: row.kimi_talk_hook ?? null,
      kimiPairings: pairings.dishes,
      kimiPairingNote: pairings.note,
      kimiCheckedAt: row.kimi_checked_at ?? null,
      kimiConfidence: row.kimi_confidence as Wine["kimiConfidence"],
      kimiUserNote: row.kimi_user_note ?? null,
      labelImageUrl: row.label_image_url ?? null,
    })
  );
}

export function wineToRow(
  wine: Wine,
  userId: string,
  opts?: { includeCellarId?: boolean; includeKimi?: boolean }
): Record<string, unknown> {
  const includeKimi = opts?.includeKimi !== false;
  const base: Record<string, unknown> = {
    id: wine.id,
    user_id: userId,
    slot: wine.slot,
    col: wine.col,
    row: wine.row,
    country: wine.country,
    region: wine.region,
    type: wine.type,
    winery: wine.winery,
    name: wine.name,
    aging: wine.aging,
    grape: wine.grape,
    vintage: wine.vintage,
    vivino: wine.vivino,
    cavatale_rating: wine.cavataleRating,
    cavatale_parts: wine.cavataleParts,
    cavatale_evidence: wine.cavataleEvidence,
    price: wine.price,
    price_currency: wine.priceCurrency ?? "MXN",
    external_rating: wine.externalRating,
    rating_source: wine.ratingSource,
    last_checked_at: wine.lastCheckedAt,
    match_confidence: wine.matchConfidence,
  };
  if (includeKimi) {
    base.kimi_vivino = wine.kimiVivino;
    base.kimi_price = wine.kimiPrice;
    base.kimi_price_currency = wine.kimiPriceCurrency;
    base.kimi_summary = wine.kimiSummary;
    base.kimi_curiosity = wine.kimiCuriosity;
    base.kimi_talk_hook = wine.kimiTalkHook;
    base.kimi_pairings = serializeKimiPairings(
      wine.kimiPairings,
      wine.kimiPairingNote
    );
    base.kimi_checked_at = wine.kimiCheckedAt;
    base.kimi_confidence = wine.kimiConfidence;
    base.kimi_user_note = wine.kimiUserNote;
  }
  base.label_image_url = wine.labelImageUrl;
  if (opts?.includeCellarId === false) return base;
  return { ...base, cellar_id: wine.cellarId };
}

export function historyFromRow(row: HistoryRow): CellarLogEntry {
  const { myRating = null, note = null, ...wine } = row.wine ?? {
    id: "",
    name: "",
    winery: "",
    country: "",
    region: "",
    type: "",
    vintage: null,
    vivino: null,
    price: null,
    slot: null,
    grape: "",
  };
  return {
    id: row.id,
    at: row.at,
    action: row.action,
    wine: {
      id: wine.id,
      name: wine.name,
      winery: wine.winery,
      country: wine.country,
      region: wine.region,
      type: wine.type,
      vintage: wine.vintage,
      vivino: wine.vivino,
      price: wine.price,
      slot: wine.slot,
      grape: wine.grape,
    },
    myRating: myRating ?? null,
    note: note ?? null,
  };
}

export function historyToRow(
  entry: CellarLogEntry,
  userId: string
): HistoryRow {
  return {
    id: entry.id,
    user_id: userId,
    at: entry.at,
    action: entry.action,
    wine: {
      ...entry.wine,
      myRating: entry.myRating,
      note: entry.note,
    },
  };
}

export function cellarFromRow(row: CellarRow): CellarUnit {
  return {
    id: row.id,
    name: row.name,
    cols: row.cols,
    rows: row.rows?.length ? row.rows : ["A", "B", "C", "D", "E", "F"],
    sortOrder: row.sort_order ?? 0,
  };
}

export function cellarToRow(unit: CellarUnit, userId: string): CellarRow {
  return {
    id: unit.id,
    user_id: userId,
    name: unit.name,
    cols: unit.cols,
    rows: unit.rows,
    sort_order: unit.sortOrder,
  };
}

export type EncounterRow = {
  id: string;
  user_id: string;
  at: string;
  wine_id: string | null;
  name: string;
  winery: string;
  country: string;
  region: string;
  type: string;
  grape: string;
  aging: string;
  vintage: number | null;
  cavatale_rating: number | null;
  cavatale_parts?: unknown;
  cavatale_evidence?: unknown;
  kimi_summary: string | null;
  kimi_curiosity: string | null;
  kimi_talk_hook: string | null;
  kimi_pairings: string | null;
  kimi_checked_at: string | null;
  kimi_confidence: string | null;
  note: string | null;
  place: string | null;
};

export function encounterFromRow(row: EncounterRow): Encounter {
  const pairings = parseKimiPairingsBlob(row.kimi_pairings);
  return {
    id: row.id,
    at: row.at,
    wineId: row.wine_id ?? null,
    name: row.name ?? "",
    winery: row.winery ?? "",
    country: row.country ?? "",
    region: row.region ?? "",
    type: row.type ?? "",
    grape: row.grape ?? "",
    aging: row.aging ?? "",
    vintage: row.vintage,
    cavataleRating:
      row.cavatale_rating != null ? Number(row.cavatale_rating) : null,
    cavataleParts: parseCavataleRatingParts(row.cavatale_parts),
    cavataleEvidence: parseCavataleRatingEvidence(row.cavatale_evidence),
    kimiSummary: row.kimi_summary ?? null,
    kimiCuriosity: row.kimi_curiosity ?? null,
    kimiTalkHook: row.kimi_talk_hook ?? null,
    kimiPairings: pairings.dishes,
    kimiPairingNote: pairings.note,
    kimiCheckedAt: row.kimi_checked_at ?? null,
    kimiConfidence: row.kimi_confidence as Encounter["kimiConfidence"],
    note: row.note ?? null,
    place: row.place ?? null,
  };
}

export function encounterToRow(
  entry: Encounter,
  userId: string
): EncounterRow {
  return {
    id: entry.id,
    user_id: userId,
    at: entry.at,
    wine_id: entry.wineId,
    name: entry.name,
    winery: entry.winery,
    country: entry.country,
    region: entry.region,
    type: entry.type,
    grape: entry.grape,
    aging: entry.aging,
    vintage: entry.vintage,
    cavatale_rating: entry.cavataleRating,
    cavatale_parts: entry.cavataleParts,
    cavatale_evidence: entry.cavataleEvidence,
    kimi_summary: entry.kimiSummary,
    kimi_curiosity: entry.kimiCuriosity,
    kimi_talk_hook: entry.kimiTalkHook,
    kimi_pairings: serializeKimiPairings(
      entry.kimiPairings,
      entry.kimiPairingNote
    ),
    kimi_checked_at: entry.kimiCheckedAt,
    kimi_confidence: entry.kimiConfidence,
    note: entry.note,
    place: entry.place,
  };
}

export const DEFAULT_CELLAR_ROWS = ["A", "B", "C", "D", "E", "F"];
export const DEFAULT_CELLAR_COLS = 12;
