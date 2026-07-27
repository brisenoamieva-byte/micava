import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import { kimiChatWithWebSearch } from "@/lib/kimi-web-search";
import {
  addKimiUsage,
  parseKimiUsage,
  recordKimiUsage,
  type KimiTokenUsage,
} from "@/lib/kimi-usage";
import {
  extractJsonObject,
  parseScanLabelResult,
  type ScanLabelFields,
} from "@/lib/scan-label";
import { captureApiFailure } from "@/lib/sentry-api";
import { wineCountriesForPrompt } from "@/lib/wine-countries";

export const runtime = "nodejs";
export const maxDuration = 60;

const KIMI_BASE = "https://api.moonshot.ai/v1";
const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
const USAGE_ROUTE = "scan-label";
const MAX_BYTES = 6 * 1024 * 1024;

const COUNTRY_PROMPT = wineCountriesForPrompt();

/**
 * Pass 1: vision. Not OCR-only — identify wines from artwork when text is missing.
 */
const VISION_SYSTEM = `Eres un sommelier / experto en identificación de vinos por ETIQUETA VISUAL.

Tu trabajo NO es solo leer texto (OCR). Muchas etiquetas modernas son casi solo imagen: ilustración, tipografía estilizada, logo, colores, composición. Debes RECONOCER el vino comercial cuando la marca es identificable por su diseño, igual que un humano que ya lo ha visto en tienda o Vivino.

Prioridad de identificación:
1) Huella visual: arte, ilustración, mascota, colores dominantes, tipografía característica, escudo/logo, layout (qué va arriba/abajo), contraetiqueta si se ve.
2) Cualquier texto legible (nombre, bodega, DO, cosecha, uvas, % vol.).
3) Conocimiento de marcas conocidas que coincidan con esa huella.

Responde SOLO con un objeto JSON válido (sin markdown) con EXACTAMENTE estas claves:
name, winery, country, region, type, grape, aging, vintage, vivino, price, confidence, notes, matchMethod, searchQuery.

Definiciones:
- name (string): nombre comercial del vino. Si la etiqueta no tiene texto pero reconoces el vino por la imagen, PON el nombre comercial real. Si no puedes identificarlo, "".
- winery (string): bodega / productor.
- country (string): exactamente uno de: ${COUNTRY_PROMPT}. Usa el nombre en español de la lista (ej. Croacia, no Croatia/Hrvatska). No inventes otro país de la lista si no corresponde.
- region (string): DO / valle / appellation. "" si no sabes.
- type (string): exactamente Tinto | Blanco | Rosado | Espumoso.
- grape (string): uva(s) si se leen o son conocidas para ESE vino; si no, "".
- aging (string): Joven/Crianza/Reserva/etc. si aplica; si no, "".
- vintage (number|null): año de cosecha si se ve; no confundir con año de embotellado; si no, null.
- vivino (number|null): score típico Vivino 1–5 SOLO si identificaste el vino concreto con certeza razonable. Si no, null (se buscará después). NUNCA inventes.
- price (number|null): precio menudeo típico en MXN (entero) si conoces ese vino en México con certeza; si no, null.
- confidence ("high"|"medium"|"low"): certeza de la IDENTIDAD del vino (no de la foto).
- notes (string): breve: qué viste (ej. "solo ilustración de búho, tipografía curva") y qué es dudoso.
- matchMethod ("text"|"visual"|"mixed"): text=principalmente OCR; visual=casi sin texto / por diseño; mixed=ambos.
- searchQuery (string): 1 consulta corta en inglés o español para buscar en internet ese vino exacto + Vivino/precio (ej. "Monte Xanic Cabernet 2020 Vivino price Mexico"). Si name="", arma query con pistas visuales.

Si la imagen no parece una etiqueta de vino, name="" y confidence="low".`;

const ENRICH_SYSTEM = `Eres un investigador de vinos para Cavatale (México).
Debes USAR la búsqueda web ($web_search) para confirmar identidad, rating Vivino y precio de referencia en MXN.
Responde SOLO con JSON válido (sin markdown) con EXACTAMENTE:
name, winery, country, region, type, grape, aging, vintage, vivino, price, confidence, notes.

Reglas:
- Busca primero en Vivino / sitios de vino / tiendas MX (La Europea, Vinoteca, Amazon MX, etc.).
- country: exactamente uno de: ${COUNTRY_PROMPT}. Usa el nombre en español de la lista.
- vivino: número 1–5 (un decimal ok) del vino/cosecha si aparece; si solo hay rango, toma el más citado; si no hay dato fiable, null.
- price: entero MXN de menudeo típico actual o reciente; si solo USD/EUR, convierte aprox. a MXN; si no hay, null.
- No inventes ratings ni precios. Prefiere null a inventar.
- Si la búsqueda corrige el nombre/bodega/país, actualízalos.
- notes: qué fuentes usaste en una frase corta (sin URLs largas).`;

type KimiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function readImageDataUrl(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      throw new Error("Falta el archivo image.");
    }
    if (!file.type.startsWith("image/")) {
      throw new Error("El archivo debe ser una imagen.");
    }
    if (file.size > MAX_BYTES) {
      throw new Error("La imagen es demasiado grande (máx. ~6 MB).");
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
    return `data:${mime};base64,${buf.toString("base64")}`;
  }

  const body = (await request.json()) as { imageDataUrl?: string };
  const dataUrl = body.imageDataUrl?.trim();
  if (!dataUrl?.startsWith("data:image/")) {
    throw new Error(
      "Envía imageDataUrl (data:image/...;base64,...) o multipart image."
    );
  }
  if (dataUrl.length > MAX_BYTES * 1.4) {
    throw new Error("La imagen es demasiado grande.");
  }
  return dataUrl;
}

type VisionExtra = {
  matchMethod?: string;
  searchQuery?: string;
};

function parseVisionExtras(raw: unknown): VisionExtra {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    matchMethod:
      typeof o.matchMethod === "string" ? o.matchMethod.trim() : undefined,
    searchQuery:
      typeof o.searchQuery === "string" ? o.searchQuery.trim() : undefined,
  };
}

function buildSearchQuery(fields: ScanLabelFields, extras: VisionExtra): string {
  if (extras.searchQuery) return extras.searchQuery;
  const parts = [
    fields.name,
    fields.winery,
    fields.vintage != null ? String(fields.vintage) : "",
    fields.region,
    "Vivino",
    "precio México",
  ].filter(Boolean);
  return parts.join(" ");
}

function mergeEnrichment(
  base: ScanLabelFields,
  enriched: ScanLabelFields
): ScanLabelFields {
  const pickStr = (a: string, b: string) => (b.trim() ? b : a);
  const pickNum = (a: number | null, b: number | null) =>
    b != null ? b : a;

  return {
    name: pickStr(base.name, enriched.name) || base.name,
    winery: pickStr(base.winery, enriched.winery),
    country:
      enriched.country && enriched.country !== "Otro"
        ? enriched.country
        : base.country,
    region: pickStr(base.region, enriched.region),
    type: enriched.type || base.type,
    grape: pickStr(base.grape, enriched.grape),
    aging: pickStr(base.aging, enriched.aging),
    vintage: pickNum(base.vintage, enriched.vintage),
    vivino: pickNum(base.vivino, enriched.vivino),
    price: pickNum(base.price, enriched.price),
    confidence:
      enriched.confidence === "high" || base.confidence === "high"
        ? enriched.vivino != null || enriched.price != null
          ? enriched.confidence === "low"
            ? base.confidence
            : enriched.confidence
          : base.confidence === "high"
            ? "high"
            : enriched.confidence
        : enriched.confidence !== "low"
          ? enriched.confidence
          : base.confidence,
    notes: [base.notes, enriched.notes].filter(Boolean).join(" · ").slice(0, 280),
  };
}

async function visionIdentify(
  apiKey: string,
  imageDataUrl: string
): Promise<{
  fields: ScanLabelFields;
  extras: VisionExtra;
  raw: unknown;
  usage: KimiTokenUsage | null;
}> {
  const kimiRes = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      max_tokens: 2048,
      messages: [
        { role: "system", content: VISION_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
            {
              type: "text",
              text: "Identifica este vino. Si casi no hay texto, usa la huella visual (arte, colores, logo). Completa el JSON incluyendo matchMethod, searchQuery, y vivino/price solo si estás seguro; si no, null.",
            },
          ],
        },
      ],
    }),
  });

  const rawText = await kimiRes.text();
  let payload: KimiChatResponse;
  try {
    payload = JSON.parse(rawText) as KimiChatResponse;
  } catch {
    throw new Error("Respuesta inválida de Kimi (visión).");
  }
  const usage = parseKimiUsage(payload);
  if (!kimiRes.ok) {
    throw Object.assign(
      new Error(payload.error?.message || `Kimi visión ${kimiRes.status}.`),
      { usage }
    );
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw Object.assign(new Error("Kimi no devolvió contenido (visión)."), {
      usage,
    });
  }

  const raw = extractJsonObject(content);
  const fields = parseScanLabelResult(raw);
  const extras = parseVisionExtras(raw);
  return { fields, extras, raw, usage };
}

async function enrichWithWeb(
  apiKey: string,
  fields: ScanLabelFields,
  extras: VisionExtra
): Promise<{ fields: ScanLabelFields | null; usage: KimiTokenUsage | null }> {
  // Skip if we already have both market fields with decent identity
  if (
    fields.vivino != null &&
    fields.price != null &&
    fields.confidence === "high"
  ) {
    return { fields: null, usage: null };
  }

  const query = buildSearchQuery(fields, extras);
  if (!query.trim() && !fields.name) return { fields: null, usage: null };

  const user = `Identidad tentativa del vino (puede venir de foto con poco texto):
- name: ${fields.name || "(desconocido)"}
- winery: ${fields.winery || ""}
- country: ${fields.country}
- region: ${fields.region}
- type: ${fields.type}
- grape: ${fields.grape}
- aging: ${fields.aging}
- vintage: ${fields.vintage ?? ""}
- matchMethod: ${extras.matchMethod || ""}
- notes visuales: ${fields.notes || ""}
- consulta sugerida: ${query}

Usa $web_search (varias búsquedas si hace falta: Vivino rating, precio México) y devuelve el JSON final con vivino y price rellenados cuando existan datos públicos.`;

  const result = await kimiChatWithWebSearch({
    apiKey,
    model: MODEL,
    system: ENRICH_SYSTEM,
    user,
    maxRounds: 4,
    maxTokens: 1536,
  });

  if (!result.content) return { fields: null, usage: result.usage };

  try {
    // Model may wrap JSON; strip if tools left prose
    const raw = extractJsonObject(result.content);
    return { fields: parseScanLabelResult(raw), usage: result.usage };
  } catch {
    return { fields: null, usage: result.usage };
  }
}

export async function POST(request: Request) {
  const guard = await guardKimiApi(request);
  if (!guard.ok) return guard.response;

  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) {
    return badRequest(
      "Falta KIMI_API_KEY en el servidor. Agrégala en .env.local y reinicia.",
      503
    );
  }

  let imageDataUrl: string;
  try {
    imageDataUrl = await readImageDataUrl(request);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Imagen inválida.");
  }

  let sessionUsage: KimiTokenUsage | null = null;
  let vision: {
    fields: ScanLabelFields;
    extras: VisionExtra;
    usage: KimiTokenUsage | null;
  };
  try {
    vision = await visionIdentify(apiKey, imageDataUrl);
    sessionUsage = addKimiUsage(sessionUsage, vision.usage);
  } catch (e) {
    captureApiFailure(USAGE_ROUTE, "vision_identify", e, 502);
    const errUsage =
      e && typeof e === "object" && "usage" in e
        ? ((e as { usage?: KimiTokenUsage | null }).usage ?? null)
        : null;
    sessionUsage = addKimiUsage(sessionUsage, errUsage);
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: MODEL,
      usage: sessionUsage,
    });
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "No se pudo contactar a la IA. Revisa tu conexión e intenta de nuevo.",
      },
      { status: 502 }
    );
  }

  let fields = vision.fields;

  if (!fields.name) {
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: MODEL,
      usage: sessionUsage,
    });
    return NextResponse.json(
      {
        error:
          fields.notes ||
          "No pude identificar el vino (ni por texto ni por diseño). Prueba más luz, de frente, o la contraetiqueta.",
        fields,
      },
      { status: 422 }
    );
  }

  // Pass 2: web search for Vivino + price (and identity confirmation)
  try {
    const enriched = await enrichWithWeb(apiKey, fields, vision.extras);
    sessionUsage = addKimiUsage(sessionUsage, enriched.usage);
    if (enriched.fields?.name) {
      fields = mergeEnrichment(fields, enriched.fields);
    }
  } catch (e) {
    // Keep vision-only result; market fields may stay null
    captureApiFailure(USAGE_ROUTE, "enrich_web", e);
  }

  const methodNote =
    vision.extras.matchMethod === "visual"
      ? "Identificado por diseño visual"
      : vision.extras.matchMethod === "mixed"
        ? "Identificado por texto + diseño"
        : vision.extras.matchMethod === "text"
          ? "Identificado por texto de etiqueta"
          : "";

  if (methodNote && !fields.notes.includes("Identificado")) {
    fields = {
      ...fields,
      notes: [methodNote, fields.notes].filter(Boolean).join(" · ").slice(0, 280),
    };
  }

  await recordKimiUsage({
    userId: guard.userId,
    route: USAGE_ROUTE,
    model: MODEL,
    usage: sessionUsage,
  });

  return NextResponse.json({ fields });
}
