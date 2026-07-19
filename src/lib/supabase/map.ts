import type { CellarLogEntry, CellarUnit, DepartAction, Wine } from "@/lib/types";
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
  price: number | null;
  external_rating: number | null;
  rating_source: string | null;
  last_checked_at: string | null;
  match_confidence: string | null;
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
  return withVerificationDefaults({
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
    price: row.price,
    externalRating: row.external_rating,
    ratingSource: row.rating_source as Wine["ratingSource"],
    lastCheckedAt: row.last_checked_at,
    matchConfidence: row.match_confidence as Wine["matchConfidence"],
  });
}

export function wineToRow(
  wine: Wine,
  userId: string,
  opts?: { includeCellarId?: boolean }
): WineRow | Omit<WineRow, "cellar_id"> {
  const base = {
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
    price: wine.price,
    external_rating: wine.externalRating,
    rating_source: wine.ratingSource,
    last_checked_at: wine.lastCheckedAt,
    match_confidence: wine.matchConfidence,
  };
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

export const DEFAULT_CELLAR_ROWS = ["A", "B", "C", "D", "E", "F"];
export const DEFAULT_CELLAR_COLS = 12;
