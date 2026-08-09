import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import { geminiGenerateJson, resolvePrimaryLlm } from "@/lib/gemini";
import {
  addKimiUsage,
  parseKimiUsage,
  recordKimiUsage,
  type KimiTokenUsage,
} from "@/lib/kimi-usage";
import {
  needsMarketEnrich,
  type EnrichHint,
} from "@/lib/scan-label-enrich";
import {
  extractJsonObject,
  parseScanLabelResult,
  type ScanLabelFields,
} from "@/lib/scan-label";
import { wineCountriesForPrompt } from "@/lib/wine-countries";

export const runtime = "nodejs";
export const maxDuration = 60;

const KIMI_BASE = "https://api.moonshot.ai/v1";
const KIMI_MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
const USAGE_ROUTE = "scan-label";
const MAX_BYTES = 6 * 1024 * 1024;

const COUNTRY_PROMPT = wineCountriesForPrompt();

/**
 * Pass 1: vision only. Market data (Vivino/price) is filled by /api/enrich-label.
 * May receive 1–2 photos (front label + optional back / contraetiqueta).
 */
const VISION_SYSTEM = `Eres un sommelier / experto en identificación de vinos por ETIQUETA VISUAL.

Tu trabajo NO es solo leer texto (OCR). Muchas etiquetas modernas son casi solo imagen: ilustración, tipografía estilizada, logo, colores, composición. Debes RECONOCER el vino comercial cuando la marca es identificable por su diseño, igual que un humano que ya lo ha visto en tienda o Vivino.

Puedes recibir 1 o 2 fotos de la MISMA botella:
- Foto 1: etiqueta frontal (frente).
- Foto 2 (opcional): contraetiqueta / reverso (datos técnicos: uvas, DO, alcohol, añada, bodega).
Combina ambas. Prioriza texto legible de la contraetiqueta para grape/aging/vintage/region cuando exista; usa el frente para nombre/bodega/huella visual.

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
- notes (string): breve: qué viste (ej. "frente ilustración + contraetiqueta con Tempranillo 2018") y qué es dudoso.
- matchMethod ("text"|"visual"|"mixed"): text=principalmente OCR; visual=casi sin texto / por diseño; mixed=ambos.
- searchQuery (string): 1 consulta corta en inglés o español para buscar en internet ese vino exacto + Vivino/precio (ej. "Monte Xanic Cabernet 2020 Vivino price Mexico"). Si name="", arma query con pistas visuales.

Si ninguna imagen parece una etiqueta de vino, name="" y confidence="low".`;

const MAX_SCAN_IMAGES = 2;

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

async function readImageDataUrls(request: Request): Promise<string[]> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const files = [
      form.get("image"),
      form.get("image2"),
      ...form.getAll("images"),
    ].filter((f): f is File => f instanceof File);
    const unique = files.slice(0, MAX_SCAN_IMAGES);
    if (unique.length === 0) {
      throw new Error("Falta el archivo image.");
    }
    const urls: string[] = [];
    for (const file of unique) {
      if (!file.type.startsWith("image/")) {
        throw new Error("El archivo debe ser una imagen.");
      }
      if (file.size > MAX_BYTES) {
        throw new Error("La imagen es demasiado grande (máx. ~6 MB).");
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
      urls.push(`data:${mime};base64,${buf.toString("base64")}`);
    }
    return urls;
  }

  const body = (await request.json()) as {
    imageDataUrl?: string;
    imageDataUrls?: unknown;
  };
  const fromArray = Array.isArray(body.imageDataUrls)
    ? body.imageDataUrls.filter(
        (u): u is string => typeof u === "string" && u.trim().startsWith("data:image/")
      )
    : [];
  const legacy =
    typeof body.imageDataUrl === "string" &&
    body.imageDataUrl.trim().startsWith("data:image/")
      ? [body.imageDataUrl.trim()]
      : [];
  const urls = (fromArray.length ? fromArray : legacy)
    .map((u) => u.trim())
    .slice(0, MAX_SCAN_IMAGES);
  if (urls.length === 0) {
    throw new Error(
      "Envía imageDataUrls (1–2 data:image/...;base64,...) o imageDataUrl, o multipart image."
    );
  }
  for (const dataUrl of urls) {
    if (dataUrl.length > MAX_BYTES * 1.4) {
      throw new Error("La imagen es demasiado grande.");
    }
  }
  return urls;
}

function parseVisionExtras(raw: unknown): EnrichHint {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    matchMethod:
      typeof o.matchMethod === "string" ? o.matchMethod.trim() : undefined,
    searchQuery:
      typeof o.searchQuery === "string" ? o.searchQuery.trim() : undefined,
  };
}

function applyMethodNote(
  fields: ScanLabelFields,
  matchMethod?: string
): ScanLabelFields {
  const methodNote =
    matchMethod === "visual"
      ? "Identificado por diseño visual"
      : matchMethod === "mixed"
        ? "Identificado por texto + diseño"
        : matchMethod === "text"
          ? "Identificado por texto de etiqueta"
          : "";

  if (!methodNote || fields.notes.includes("Identificado")) return fields;
  return {
    ...fields,
    notes: [methodNote, fields.notes].filter(Boolean).join(" · ").slice(0, 280),
  };
}

async function visionIdentify(
  llm: { provider: "gemini" | "kimi"; apiKey: string; model: string },
  imageDataUrls: string[]
): Promise<{
  fields: ScanLabelFields;
  extras: EnrichHint;
  usage: KimiTokenUsage | null;
}> {
  const multi = imageDataUrls.length > 1;
  const userText = multi
    ? "Hay 2 fotos de la misma botella: la primera es el FRENTE (etiqueta) y la segunda el REVERSO (contraetiqueta). Combina ambas. Si casi no hay texto en el frente, usa la huella visual y lee la contraetiqueta. Completa el JSON incluyendo matchMethod, searchQuery, y vivino/price solo si estás seguro; si no, null."
    : "Identifica este vino. Si casi no hay texto, usa la huella visual (arte, colores, logo). Completa el JSON incluyendo matchMethod, searchQuery, y vivino/price solo si estás seguro; si no, null.";

  let content: string;
  let usage: KimiTokenUsage | null;

  if (llm.provider === "gemini") {
    const out = await geminiGenerateJson({
      apiKey: llm.apiKey,
      model: llm.model,
      system: VISION_SYSTEM,
      userText,
      images: imageDataUrls,
      maxTokens: 2048,
      temperature: 0.6,
    });
    content = out.content;
    usage = out.usage;
  } else {
    const imageParts = imageDataUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    }));
    const kimiRes = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llm.model || KIMI_MODEL,
        thinking: { type: "disabled" },
        temperature: 0.6,
        response_format: { type: "json_object" },
        max_tokens: 2048,
        messages: [
          { role: "system", content: VISION_SYSTEM },
          {
            role: "user",
            content: [...imageParts, { type: "text", text: userText }],
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
    usage = parseKimiUsage(payload);
    if (!kimiRes.ok) {
      throw Object.assign(
        new Error(payload.error?.message || `Kimi visión ${kimiRes.status}.`),
        { usage }
      );
    }

    const kimiContent = payload.choices?.[0]?.message?.content?.trim();
    if (!kimiContent) {
      throw Object.assign(new Error("Kimi no devolvió contenido (visión)."), {
        usage,
      });
    }
    content = kimiContent;
  }

  const raw = extractJsonObject(content);
  const fields = parseScanLabelResult(raw);
  const extras = parseVisionExtras(raw);
  return { fields, extras, usage };
}

export async function POST(request: Request) {
  const guard = await guardKimiApi(request);
  if (!guard.ok) return guard.response;

  const llm = resolvePrimaryLlm();
  if (!llm) {
    return badRequest(
      "Falta GEMINI_API_KEY o KIMI_API_KEY en el servidor. Agrégala en .env.local y reinicia.",
      503
    );
  }

  let imageDataUrls: string[];
  try {
    imageDataUrls = await readImageDataUrls(request);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Imagen inválida.");
  }

  let sessionUsage: KimiTokenUsage | null = null;
  let vision: {
    fields: ScanLabelFields;
    extras: EnrichHint;
    usage: KimiTokenUsage | null;
  };
  try {
    vision = await visionIdentify(llm, imageDataUrls);
    sessionUsage = addKimiUsage(sessionUsage, vision.usage);
  } catch (e) {
    const errUsage =
      e && typeof e === "object" && "usage" in e
        ? ((e as { usage?: KimiTokenUsage | null }).usage ?? null)
        : null;
    sessionUsage = addKimiUsage(sessionUsage, errUsage);
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: llm.model,
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

  const fields = applyMethodNote(vision.fields, vision.extras.matchMethod);

  await recordKimiUsage({
    userId: guard.userId,
    route: USAGE_ROUTE,
    model: llm.model,
    usage: sessionUsage,
  });

  if (!fields.name) {
    return NextResponse.json(
      {
        error:
          fields.notes ||
          "No pude identificar el vino (ni por texto ni por diseño). Prueba más luz, de frente, o la contraetiqueta.",
        fields,
        needsEnrich: false,
      },
      { status: 422 }
    );
  }

  const needsEnrich = needsMarketEnrich(fields);
  return NextResponse.json({
    fields,
    needsEnrich,
    enrichHint: needsEnrich
      ? {
          matchMethod: vision.extras.matchMethod || "",
          searchQuery: vision.extras.searchQuery || "",
        }
      : undefined,
  });
}
