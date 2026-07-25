import type { CellarLogEntry, CellarUnit, Wine } from "@/lib/types";

export type CellarExportPayload = {
  exportedAt: string;
  brand: "Cavatale";
  bottleCount: number;
  cellars: Array<{
    id: string;
    name: string;
    cols: number;
    rows: string[];
    sortOrder: number;
  }>;
  wines: Array<Record<string, string | number | boolean | null>>;
  history: Array<Record<string, string | number | null>>;
};

function cellarNameById(
  cellars: CellarUnit[],
  cellarId: string | null
): string {
  if (!cellarId) return "";
  return cellars.find((c) => c.id === cellarId)?.name ?? "";
}

function locationLabel(wine: Wine, cellarName: string): string {
  if (!wine.slot || wine.slot === "abajo") {
    return wine.slot === "abajo" ? "Abajo / fuera" : "";
  }
  return cellarName ? `${cellarName} · ${wine.slot}` : wine.slot;
}

function wineExportRow(
  wine: Wine,
  cellars: CellarUnit[]
): Record<string, string | number | boolean | null> {
  const mueble = cellarNameById(cellars, wine.cellarId);
  return {
    id: wine.id,
    name: wine.name,
    winery: wine.winery,
    country: wine.country,
    region: wine.region,
    type: wine.type,
    grape: wine.grape,
    aging: wine.aging,
    vintage: wine.vintage,
    vivino: wine.vivino,
    cavataleRating: wine.cavataleRating,
    price: wine.price,
    mueble,
    slot: wine.slot,
    location: locationLabel(wine, mueble),
    externalRating: wine.externalRating,
    ratingSource: wine.ratingSource,
    matchConfidence: wine.matchConfidence,
    lastCheckedAt: wine.lastCheckedAt,
    kimiVivino: wine.kimiVivino,
    kimiPrice: wine.kimiPrice,
    kimiSummary: wine.kimiSummary,
    kimiCuriosity: wine.kimiCuriosity,
    kimiTalkHook: wine.kimiTalkHook,
    kimiPairings: wine.kimiPairings?.join("; ") ?? null,
    kimiPairingNote: wine.kimiPairingNote,
    kimiCheckedAt: wine.kimiCheckedAt,
    kimiConfidence: wine.kimiConfidence,
  };
}

function historyExportRow(
  entry: CellarLogEntry
): Record<string, string | number | null> {
  return {
    id: entry.id,
    at: entry.at,
    action: entry.action,
    myRating: entry.myRating,
    note: entry.note,
    wineId: entry.wine.id,
    name: entry.wine.name,
    winery: entry.wine.winery,
    country: entry.wine.country,
    region: entry.wine.region,
    type: entry.wine.type,
    grape: entry.wine.grape,
    vintage: entry.wine.vintage,
    vivino: entry.wine.vivino,
    price: entry.wine.price,
    slot: entry.wine.slot,
  };
}

const CSV_WINE_COLUMNS = [
  "name",
  "winery",
  "country",
  "region",
  "type",
  "grape",
  "aging",
  "vintage",
  "vivino",
  "cavataleRating",
  "price",
  "mueble",
  "slot",
  "location",
  "externalRating",
  "ratingSource",
  "matchConfidence",
  "lastCheckedAt",
  "kimiVivino",
  "kimiPrice",
  "kimiSummary",
  "kimiCuriosity",
  "kimiTalkHook",
  "kimiPairings",
  "kimiCheckedAt",
  "id",
] as const;

const CSV_HISTORY_COLUMNS = [
  "at",
  "action",
  "name",
  "winery",
  "country",
  "region",
  "type",
  "grape",
  "vintage",
  "vivino",
  "price",
  "slot",
  "myRating",
  "note",
  "wineId",
  "id",
] as const;

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function rowsToCsv(
  columns: readonly string[],
  rows: Array<Record<string, string | number | boolean | null>>
): string {
  const header = columns.join(",");
  const body = rows
    .map((row) => columns.map((col) => csvEscape(row[col])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

export function buildCellarExport(
  wines: Wine[],
  cellars: CellarUnit[],
  history: CellarLogEntry[]
): CellarExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    brand: "Cavatale",
    bottleCount: wines.length,
    cellars: cellars.map((c) => ({
      id: c.id,
      name: c.name,
      cols: c.cols,
      rows: [...c.rows],
      sortOrder: c.sortOrder,
    })),
    wines: wines.map((w) => wineExportRow(w, cellars)),
    history: history.map(historyExportRow),
  };
}

/** UTF-8 CSV of current bottles (Excel-friendly BOM). */
export function winesToCsv(wines: Wine[], cellars: CellarUnit[]): string {
  const rows = wines.map((w) => wineExportRow(w, cellars));
  return `\uFEFF${rowsToCsv(CSV_WINE_COLUMNS, rows)}`;
}

/** UTF-8 CSV of departure history. */
export function historyToCsv(history: CellarLogEntry[]): string {
  const rows = history.map(historyExportRow);
  return `\uFEFF${rowsToCsv(CSV_HISTORY_COLUMNS, rows)}`;
}

export function cellarExportToJson(
  wines: Wine[],
  cellars: CellarUnit[],
  history: CellarLogEntry[]
): string {
  return `${JSON.stringify(buildCellarExport(wines, cellars, history), null, 2)}\n`;
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function downloadTextFile(
  content: string,
  filename: string,
  mime: string
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadWinesCsv(
  wines: Wine[],
  cellars: CellarUnit[]
): void {
  downloadTextFile(
    winesToCsv(wines, cellars),
    `cavatale-cava-${stamp()}.csv`,
    "text/csv;charset=utf-8"
  );
}

export function downloadHistoryCsv(history: CellarLogEntry[]): void {
  downloadTextFile(
    historyToCsv(history),
    `cavatale-historial-${stamp()}.csv`,
    "text/csv;charset=utf-8"
  );
}

export function downloadCellarJson(
  wines: Wine[],
  cellars: CellarUnit[],
  history: CellarLogEntry[]
): void {
  downloadTextFile(
    cellarExportToJson(wines, cellars, history),
    `cavatale-cava-${stamp()}.json`,
    "application/json;charset=utf-8"
  );
}
