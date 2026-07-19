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
  price: number | null;
  /** Score looked up on an external platform (manual for now). */
  externalRating: number | null;
  ratingSource: RatingSource | null;
  /** ISO timestamp of last verification. */
  lastCheckedAt: string | null;
  matchConfidence: MatchConfidence | null;
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
  | "vivino-desc"
  | "vivino-asc"
  | "price-desc"
  | "price-asc";

export type Filters = {
  query: string;
  country: string;
  type: string;
  grape: string;
  minVivino: number | null;
  maxVivino: number | null;
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
};
