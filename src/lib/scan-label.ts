import type { WineDraft, WineType } from "@/lib/types";

/** Catalog fields from a wine label (mirrors WineDraft except cellar placement). */
export type ScanLabelFields = {
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
  confidence: "high" | "medium" | "low";
  notes: string;
};

/** Every WineDraft catalog field the scanner is responsible for. */
export const SCAN_CATALOG_KEYS = [
  "name",
  "winery",
  "country",
  "region",
  "type",
  "grape",
  "aging",
  "vintage",
  "vivino",
  "price",
] as const satisfies ReadonlyArray<keyof WineDraft>;

/** Keep in sync with `countryFlagEmoji` in wines.ts — listed here to avoid import cycles. */
const KNOWN_COUNTRIES = [
  "España",
  "México",
  "Argentina",
  "Chile",
  "Francia",
  "Italia",
  "USA",
  "Australia",
] as const;

const COUNTRY_ALIASES: Record<string, string> = {
  spain: "España",
  españa: "España",
  espana: "España",
  mexico: "México",
  méxico: "México",
  argentina: "Argentina",
  chile: "Chile",
  france: "Francia",
  francia: "Francia",
  italy: "Italia",
  italia: "Italia",
  "united states": "USA",
  "estados unidos": "USA",
  usa: "USA",
  us: "USA",
  australia: "Australia",
};

const WINE_TYPES = ["Tinto", "Blanco", "Rosado", "Espumoso"] as const;

export function normalizeCountry(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Otro";
  const exact = KNOWN_COUNTRIES.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact;
  const alias = COUNTRY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  return "Otro";
}

export function normalizeType(raw: string): WineType {
  const t = raw.trim().toLowerCase();
  if (!t) return "Tinto";
  if (t.includes("blanc") || t.includes("white")) return "Blanco";
  if (t.includes("ros") || t.includes("pink")) return "Rosado";
  if (
    t.includes("espum") ||
    t.includes("spark") ||
    t.includes("cava") ||
    t.includes("champ")
  ) {
    return "Espumoso";
  }
  if (t.includes("tint") || t.includes("red") || t.includes("rojo")) {
    return "Tinto";
  }
  const exact = WINE_TYPES.find((x) => x.toLowerCase() === t);
  return exact ?? "Tinto";
}

function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/** Pull the first JSON object from a model reply (handles ``` fences). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("La IA no devolvió JSON válido.");
  }
}

export function parseScanLabelResult(raw: unknown): ScanLabelFields {
  if (!raw || typeof raw !== "object") {
    throw new Error("Respuesta de escaneo inválida.");
  }
  const o = raw as Record<string, unknown>;
  const confidenceRaw = asString(o.confidence).toLowerCase();
  const confidence: ScanLabelFields["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : "medium";

  let vivino = asOptionalNumber(o.vivino);
  if (vivino != null && (vivino < 1 || vivino > 5)) vivino = null;

  let vintage = asOptionalNumber(o.vintage);
  if (vintage != null) {
    vintage = Math.round(vintage);
    if (vintage < 1900 || vintage > 2100) vintage = null;
  }

  let price = asOptionalNumber(o.price);
  if (price != null) {
    price = Math.round(price);
    if (price <= 0 || price > 1_000_000) price = null;
  }

  return {
    name: asString(o.name),
    winery: asString(o.winery),
    country: normalizeCountry(asString(o.country)),
    region: asString(o.region),
    type: normalizeType(asString(o.type)),
    grape: asString(o.grape),
    aging: asString(o.aging),
    vintage,
    vivino,
    price,
    confidence,
    notes: asString(o.notes),
  };
}

export function scanFieldsToDraftPatch(
  fields: ScanLabelFields
): Pick<WineDraft, (typeof SCAN_CATALOG_KEYS)[number]> {
  return {
    name: fields.name,
    winery: fields.winery,
    country: fields.country,
    region: fields.region,
    type: fields.type,
    grape: fields.grape,
    aging: fields.aging,
    vintage: fields.vintage,
    vivino: fields.vivino,
    price: fields.price,
  };
}

/** Labels for empty catalog fields after a scan (UI hint). */
export function missingScanFieldLabels(fields: ScanLabelFields): string[] {
  const labels: { key: (typeof SCAN_CATALOG_KEYS)[number]; label: string }[] = [
    { key: "name", label: "nombre" },
    { key: "winery", label: "bodega" },
    { key: "country", label: "país" },
    { key: "region", label: "región" },
    { key: "type", label: "tipo" },
    { key: "grape", label: "uva" },
    { key: "aging", label: "añejamiento" },
    { key: "vintage", label: "año" },
    { key: "vivino", label: "Vivino" },
    { key: "price", label: "precio" },
  ];
  return labels
    .filter(({ key }) => {
      const v = fields[key];
      if (key === "country") return !v || v === "Otro";
      return v == null || v === "";
    })
    .map((x) => x.label);
}

/** Resize + JPEG-compress for cheaper vision calls. */
export async function imageFileToDataUrl(
  file: File,
  maxSide = 1280,
  quality = 0.82
): Promise<{ dataUrl: string; mimeType: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo debe ser una imagen.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo procesar la imagen.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, mimeType: "image/jpeg" };
}
