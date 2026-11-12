import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import {
  geminiGenerateJson,
  resolveKimiFallback,
  resolvePrimaryLlm,
  SCAN_LABEL_RESPONSE_SCHEMA,
} from "@/lib/gemini";
import {
  addKimiUsage,
  KIMI_API_TEMPERATURE,
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
const VISION_SYSTEM = `Eres un experto en identificación de BOTELLAS por ETIQUETA VISUAL (vino o destilado: ron, whisky, tequila, mezcal, gin, cognac, etc.).

Tu trabajo NO es solo leer texto (OCR). Muchas etiquetas son casi solo imagen: ilustración, tipografía, logo, colores. Debes RECONOCER la botella comercial cuando la marca es identificable por diseño.

Puedes recibir 1 o 2 fotos de la MISMA botella:
- Foto 1: etiqueta frontal (frente).
- Foto 2 (opcional): contraetiqueta / reverso (datos técnicos: uvas o base, DO/appellation, alcohol, añada/edad, productor).
Combina ambas. Prioriza texto legible del reverso para grape/aging/vintage/region; usa el frente para nombre/marca/huella visual.

Prioridad de identificación:
1) Huella visual: arte, tipografía, logo, colores, layout, contraetiqueta si se ve.
2) Texto legible (nombre, productor, región, cosecha/edad, uvas o base, % vol.).
3) Marcas conocidas que coincidan con esa huella.

Responde SOLO con un objeto JSON válido (sin markdown) con EXACTAMENTE estas claves:
name, winery, country, region, type, grape, aging, vintage, vivino, price, confidence, notes, matchMethod, searchQuery.

Definiciones:
- name (string): nombre comercial. Si reconoces la botella por imagen, PON el nombre real. Si no, "".
- winery (string): bodega / destilería / productor / marca.
- country (string): exactamente uno de: ${COUNTRY_PROMPT}. Nombre en español de la lista.
- region (string): DO / valle / appellation / isla / estado. "" si no sabes.
- type (string): exactamente uno de: Tinto | Blanco | Rosado | Espumoso | Ron | Whisky | Tequila | Mezcal | Gin | Cognac | Otro destilado.
  Detecta bien vino vs destilado. NO marques un ron como Tinto.
- grape (string): para VINO = uva(s). Para DESTILADO = base/estilo si se lee (ej. "melaza", "agricole", "agave azul", "cebada"); si no, "".
- aging (string): vino = Joven/Crianza/Reserva/etc. Destilado = edad o declaración (ej. "12 años", "Añejo", "XO") si aplica; si no, "".
- vintage (number|null): SOLO año de cosecha/vintage/embotellado de añada si está impreso con claridad. NUNCA inventes. No uses lotes ni códigos. Si no se lee → null.
- vivino (number|null): score Vivino 1–5 SOLO para VINOS con certeza. Para destilados siempre null.
- price (number|null): precio menudeo típico MXN (entero) si conoces esa botella en México con certeza; si no, null.
- confidence ("high"|"medium"|"low"): certeza de IDENTIDAD (nombre+productor+línea).
- notes (string): breve qué viste y qué es dudoso.
- matchMethod ("text"|"visual"|"mixed").
- searchQuery (string): consulta corta para buscar esa botella + precio México (y Vivino solo si es vino). Incluye vintage SOLO si lo leíste.

Si ninguna imagen parece etiqueta de bebida, name="" y confidence="low".`;

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
    ? "Hay 2 fotos de la misma botella: la primera es el FRENTE (etiqueta) y la segunda el REVERSO (contraetiqueta). Combina ambas. Prioriza la contraetiqueta para grape/aging/vintage. Si no lees la añada con claridad, vintage=null (no inventes). Completa el JSON con matchMethod y searchQuery; vivino/price solo si estás seguro."
    : "Identifica este vino por el frente. Si casi no hay texto, usa la huella visual (arte, colores, logo). Si no ves la añada impresa, vintage=null — no inventes un año típico. Completa el JSON con matchMethod y searchQuery; vivino/price solo si estás seguro.";

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
      responseSchema: SCAN_LABEL_RESPONSE_SCHEMA,
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
        temperature: KIMI_API_TEMPERATURE,
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
  let usedModel = llm.model;
  let vision: {
    fields: ScanLabelFields;
    extras: EnrichHint;
    usage: KimiTokenUsage | null;
  };
  try {
    vision = await visionIdentify(llm, imageDataUrls);
    sessionUsage = addKimiUsage(sessionUsage, vision.usage);
  } catch (primaryError) {
    const errUsage =
      primaryError && typeof primaryError === "object" && "usage" in primaryError
        ? ((primaryError as { usage?: KimiTokenUsage | null }).usage ?? null)
        : null;
    sessionUsage = addKimiUsage(sessionUsage, errUsage);

    const kimiFallback =
      llm.provider === "gemini" ? resolveKimiFallback() : null;
    if (kimiFallback) {
      console.warn(
        "[scan-label] primary LLM failed, trying Kimi:",
        primaryError instanceof Error ? primaryError.message : primaryError
      );
      try {
        vision = await visionIdentify(kimiFallback, imageDataUrls);
        sessionUsage = addKimiUsage(sessionUsage, vision.usage);
        usedModel = kimiFallback.model;
      } catch (fallbackError) {
        const fbUsage =
          fallbackError &&
          typeof fallbackError === "object" &&
          "usage" in fallbackError
            ? ((fallbackError as { usage?: KimiTokenUsage | null }).usage ??
              null)
            : null;
        sessionUsage = addKimiUsage(sessionUsage, fbUsage);
        await recordKimiUsage({
          userId: guard.userId,
          route: USAGE_ROUTE,
          model: usedModel,
          usage: sessionUsage,
        });
        return NextResponse.json(
          {
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : primaryError instanceof Error
                  ? primaryError.message
                  : "No se pudo contactar a la IA. Revisa tu conexión e intenta de nuevo.",
          },
          { status: 502 }
        );
      }
    } else {
      await recordKimiUsage({
        userId: guard.userId,
        route: USAGE_ROUTE,
        model: llm.model,
        usage: sessionUsage,
      });
      return NextResponse.json(
        {
          error:
            primaryError instanceof Error
              ? primaryError.message
              : "No se pudo contactar a la IA. Revisa tu conexión e intenta de nuevo.",
        },
        { status: 502 }
      );
    }
  }

  const fields = applyMethodNote(vision.fields, vision.extras.matchMethod);

  await recordKimiUsage({
    userId: guard.userId,
    route: USAGE_ROUTE,
    model: usedModel,
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
