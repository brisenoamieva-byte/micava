import type { WineDraft, WineType } from "@/lib/types";
import { normalizeCountry } from "@/lib/wine-countries";

export { normalizeCountry } from "@/lib/wine-countries";

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

const WINE_TYPES = ["Tinto", "Blanco", "Rosado", "Espumoso"] as const;

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

/** Light repairs for common LLM JSON glitches. */
function repairJsonCandidate(raw: string): string {
  let s = raw.replace(/^\uFEFF/, "").trim();
  // Smart / curly quotes → straight (only outside already-escaped contexts is hard;
  // converting all curly quotes is usually safe for model output).
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  // Trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, "$1");
  // Missing commas between a finished value and the next key on a new line.
  // e.g. "foo": "bar"\n  "baz"  or  "n": 1\n  "m"
  s = s.replace(
    /("(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\r?\n(\s*")/g,
    "$1,\n$2"
  );
  // Missing commas after } or ] when another key follows
  s = s.replace(/([}\]])\s*\r?\n(\s*")/g, "$1,\n$2");
  return s;
}

/** Pull the first JSON object from a model reply (handles ``` fences). */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const attempts = [candidate];
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    attempts.push(candidate.slice(start, end + 1));
  }
  let lastError: unknown;
  for (const attempt of attempts) {
    for (const variant of [attempt, repairJsonCandidate(attempt)]) {
      try {
        return JSON.parse(variant);
      } catch (e) {
        lastError = e;
      }
    }
  }
  if (lastError instanceof SyntaxError) {
    throw new Error(`La IA no devolvió JSON válido: ${lastError.message}`);
  }
  throw new Error("La IA no devolvió JSON válido.");
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

/**
 * Apply scan/AI catalog fields onto a draft.
 * Never overwrite a price (or score) the user already typed with null or a new estimate.
 */
export function mergeScanPatchIntoDraft(
  prev: WineDraft,
  patch: Pick<WineDraft, (typeof SCAN_CATALOG_KEYS)[number]>
): WineDraft {
  return {
    ...prev,
    ...patch,
    vivino: prev.vivino != null ? prev.vivino : patch.vivino,
    price: prev.price != null ? prev.price : patch.price,
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

export type ScanLabelEnrichHint = {
  matchMethod?: string;
  searchQuery?: string;
};

export type ScanLabelApiSuccess = {
  fields: ScanLabelFields;
  needsEnrich: boolean;
  enrichHint?: ScanLabelEnrichHint;
  error?: string;
};

/** Vision-only identify. Market data comes from fetchEnrichLabel. */
export const MAX_SCAN_LABEL_IMAGES = 2;

export async function fetchScanLabel(
  imageDataUrls: string | string[],
  signal?: AbortSignal
): Promise<{
  status: number;
  payload: ScanLabelApiSuccess & { error?: string };
}> {
  const urls = (Array.isArray(imageDataUrls) ? imageDataUrls : [imageDataUrls])
    .map((u) => u.trim())
    .filter((u) => u.startsWith("data:image/"))
    .slice(0, MAX_SCAN_LABEL_IMAGES);
  if (urls.length === 0) {
    throw new Error("Falta al menos una imagen de la etiqueta.");
  }

  const res = await fetch("/api/scan-label", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      urls.length === 1
        ? { imageDataUrl: urls[0], imageDataUrls: urls }
        : { imageDataUrls: urls }
    ),
    signal,
  });
  const raw = await res.text();
  let payload: ScanLabelApiSuccess & { error?: string } = {
    fields: {
      name: "",
      winery: "",
      country: "Otro",
      region: "",
      type: "Tinto",
      grape: "",
      aging: "",
      vintage: null,
      vivino: null,
      price: null,
      confidence: "low",
      notes: "",
    },
    needsEnrich: false,
  };
  try {
    payload = JSON.parse(raw) as ScanLabelApiSuccess & { error?: string };
  } catch {
    throw new Error(
      res.status === 504 || res.status === 408
        ? "El escaneo tardó demasiado. Intenta de nuevo con mejor luz."
        : res.ok
          ? "La IA respondió en un formato inesperado. Reintenta."
          : "El servidor falló al escanear. Reintenta en un momento."
    );
  }
  return { status: res.status, payload };
}

/** Background market/price pass after identity is already shown. */
export async function fetchEnrichLabel(
  fields: ScanLabelFields,
  enrichHint?: ScanLabelEnrichHint,
  signal?: AbortSignal
): Promise<ScanLabelFields | null> {
  const res = await fetch("/api/enrich-label", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields, enrichHint }),
    signal,
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as {
    fields?: ScanLabelFields;
    enriched?: boolean;
  };
  return payload.fields ?? null;
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
