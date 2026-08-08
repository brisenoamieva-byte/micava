export type WineType = "Tinto" | "Blanco" | "Rosado" | "Espumoso" | string;

export type RatingSource = "vivino" | "wine-searcher" | "manual";
export type MatchConfidence = "confirmed" | "likely" | "uncertain";

export type Wine = {
  id: string;
  /** Furniture unit this bottle sits in (null = unassigned / abajo). */
  cellarId: string | null;
  slot: string | null;
  col: number | null;
  row: string | null;
  country: string;
  region: string;
  type: WineType;
  winery: string;
  name: string;
  aging: string;
  grape: string;
  vintage: number | null;
  vivino: number | null;
  /** Official Cavatale score (1–5) from Kimi research — not Vivino. */
  cavataleRating: number | null;
  /** Axis scores that produced cavataleRating (taste/story/table/originality). */
  cavataleParts: import("@/lib/cavatale-rating").CavataleRatingParts | null;
  /** Sanitized evidence enums behind the axes. */
  cavataleEvidence: import("@/lib/cavatale-rating").CavataleRatingEvidence | null;
  price: number | null;
  /** ISO 4217 for `price`; null/absent treated as MXN. */
  priceCurrency: string | null;
  /** Score looked up on an external platform (manual for now). */
  externalRating: number | null;
  ratingSource: RatingSource | null;
  /** ISO timestamp of last verification. */
  lastCheckedAt: string | null;
  matchConfidence: MatchConfidence | null;
  /** Storage path for the user's scanned label photo ({userId}/{wineId}.jpg). */
  labelImageUrl: string | null;
  /** Kimi estimate of community Vivino score (1–5), for reference. */
  kimiVivino: number | null;
  /** Kimi / verify estimate of typical retail price (amount in kimiPriceCurrency). */
  kimiPrice: number | null;
  /** ISO 4217 for `kimiPrice`; null treated as MXN (legacy Contar historia). */
  kimiPriceCurrency: string | null;
  /** Short story / discovery note from research IA. */
  kimiSummary: string | null;
  /** One memorable curiosity about the wine. */
  kimiCuriosity: string | null;
  /** Conversation hook / question to spark talk. */
  kimiTalkHook: string | null;
  /** AI food pairings for this bottle (overrides rule-based when set). */
  kimiPairings: string[] | null;
  /** Short note explaining the AI pairing thread. */
  kimiPairingNote: string | null;
  /** ISO timestamp of last Kimi research. */
  kimiCheckedAt: string | null;
  kimiConfidence: MatchConfidence | null;
  /**
   * Owner dispute/feedback about the story (not ground truth).
   * Passed to research as a contested claim for review.
   */
  kimiUserNote: string | null;
};

/** One physical furniture unit / grid belonging to a user. */
export type CellarUnit = {
  id: string;
  name: string;
  cols: number;
  rows: string[];
  sortOrder: number;
};

export type CellarData = {
  meta: {
    brand: string;
    importedAt: string;
    bottleCount: number;
    gridCols: number;
    gridRows: string[];
  };
  grid: Record<string, string | null>;
  wines: Wine[];
};

export type SortOption =
  | "default"
  | "cavatale-desc"
  | "cavatale-asc"
  | "price-desc"
  | "price-asc";

export type Filters = {
  query: string;
  country: string;
  type: string;
  grape: string;
  minCavatale: number | null;
  maxCavatale: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  sort: SortOption;
};

export type WineDraft = {
  name: string;
  winery: string;
  country: string;
  region: string;
  type: WineType;
  grape: string;
  aging: string;
  vintage: number | null;
  vivino: number | null;
  price: number | null;
  cellarId: string | null;
  location: string; // "11F" | "abajo" | ""
};

export type DepartAction = "opened" | "gifted" | "removed";

/** Snapshot kept when a bottle leaves the cellar. */
export type CellarLogEntry = {
  id: string;
  at: string;
  action: DepartAction;
  wine: Pick<
    Wine,
    | "id"
    | "name"
    | "winery"
    | "country"
    | "region"
    | "type"
    | "vintage"
    | "vivino"
    | "price"
    | "slot"
    | "grape"
  >;
  /** Your taste after opening (1–5). Optional for gift/remove. */
  myRating: number | null;
  /** Short memory note — what you liked / would buy again. */
  note: string | null;
};

export type DepartExtras = {
  myRating?: number | null;
  note?: string | null;
};

/**
 * A table encounter saved to the bitácora — story snapshot, not a cellar bottle.
 * Identity and kimi fields are snapshotted so the tale survives without adding to cava.
 */
export type Encounter = {
  id: string;
  at: string;
  /** Optional link if the bottle was later (or already) in inventory. */
  wineId: string | null;
  name: string;
  winery: string;
  country: string;
  region: string;
  type: WineType;
  grape: string;
  aging: string;
  vintage: number | null;
  cavataleRating: number | null;
  cavataleParts: import("@/lib/cavatale-rating").CavataleRatingParts | null;
  cavataleEvidence: import("@/lib/cavatale-rating").CavataleRatingEvidence | null;
  kimiSummary: string | null;
  kimiCuriosity: string | null;
  kimiTalkHook: string | null;
  kimiPairings: string[] | null;
  kimiPairingNote: string | null;
  kimiCheckedAt: string | null;
  kimiConfidence: MatchConfidence | null;
  /** Unused in UI; kept nullable for DB compatibility. */
  place: string | null;
  /** Unused in UI; kept nullable for DB compatibility. */
  note: string | null;
};

/** Identity draft for Contar historia without mueble/slot. */
export type EncounterDraft = {
  name: string;
  winery: string;
  country: string;
  region: string;
  type: WineType;
  grape: string;
  aging: string;
  vintage: number | null;
};
