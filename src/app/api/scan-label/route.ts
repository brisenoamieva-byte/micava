import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import {
  extractJsonObject,
  parseScanLabelResult,
  type ScanLabelFields,
} from "@/lib/scan-label";

export const runtime = "nodejs";
export const maxDuration = 60;

const KIMI_BASE = "https://api.moonshot.ai/v1";
const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
const MAX_BYTES = 6 * 1024 * 1024; // ~6MB decoded image budget via data URL length

const SYSTEM = `Eres un experto en vinos. Analizas fotos de etiquetas (frente y/o contraetiqueta) para rellenar la ficha completa de Cavatale.

Responde SOLO con un objeto JSON válido (sin markdown) con EXACTAMENTE estas claves:
name, winery, country, region, type, grape, aging, vintage, vivino, price, confidence, notes.

Debes intentar completar TODOS los campos de catálogo. Lee todo el texto visible (nombre, bodega, DO, cosecha, variedades, crianza, % vol., etc.).

Definiciones (todas obligatorias en el JSON):
- name (string): nombre comercial del vino tal como aparece (ej. "Viña Alberdi", "Un Poco Loco"). No pongas solo la bodega aquí.
- winery (string): bodega / productor / maison (ej. "La Rioja Alta", "Casa Madero").
- country (string): país en español, uno de: España, México, Argentina, Chile, Francia, Italia, USA, Australia, Otro. Infórmalo aunque solo diga la región (Rioja→España, Mendoza→Argentina, Valle de Guadalupe→México, Bordeaux→Francia, Napa→USA).
- region (string): DO / DOC / appellation / valle / zona (ej. "Rioja", "Ribera del Duero", "Valle de Guadalupe", "Mendoza", "Champagne"). Si no se ve ni se infiere con alta confianza, "".
- type (string): exactamente uno de: Tinto, Blanco, Rosado, Espumoso. Usa color, estilo o palabras como "red/white/rosé/sparkling/cava/champagne".
- grape (string): uva(s). Prioridad: (1) texto en etiqueta/contraetiqueta, (2) si el vino es claramente identificable, variedades típicas conocidas (ej. Tempranillo, Malbec, Cabernet Sauvignon). Varias uvas separadas por coma. Si no sabes, "".
- aging (string): nivel o estilo de crianza si aparece o es parte del nombre/línea: Joven, Crianza, Reserva, Gran Reserva, Roble, Barrica, meses en barrica, etc. Si no hay indicios, "".
- vintage (number|null): año de cosecha (4 dígitos) si se ve en la etiqueta. No uses el año de embotellado si está claramente marcado como tal. Si no se ve, null.
- vivino (number|null): calificación típica Vivino 1–5 SOLO si conoces ese vino con certeza. Si no estás seguro, null. NUNCA inventes.
- price (number|null): precio de referencia en MXN solo si se ve en la foto (etiqueta de tienda, sticker) o si conoces un precio típico de ese vino en México con alta confianza. Si no, null. Solo el número entero, sin símbolo.
- confidence ("high"|"medium"|"low"): legibilidad y certeza global de la identificación.
- notes (string): frase corta en español: qué faltó o qué es dudoso (ej. "año borroso", "uva no legible"). "" si todo está claro.

Si la imagen no es una etiqueta de vino, name="" y confidence="low".`;

type KimiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
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
    throw new Error("Envía imageDataUrl (data:image/...;base64,...) o multipart image.");
  }
  if (dataUrl.length > MAX_BYTES * 1.4) {
    throw new Error("La imagen es demasiado grande.");
  }
  return dataUrl;
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

  let kimiRes: Response;
  try {
    kimiRes = await fetch(`${KIMI_BASE}/chat/completions`, {
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
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageDataUrl },
              },
              {
                type: "text",
                text: "Identifica este vino y completa TODOS los campos del JSON: name, winery, country, region, type, grape, aging, vintage, vivino, price. Usa null o \"\" solo cuando realmente no se pueda saber.",
              },
            ],
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar a Kimi. Revisa tu conexión." },
      { status: 502 }
    );
  }

  const rawText = await kimiRes.text();
  let payload: KimiChatResponse;
  try {
    payload = JSON.parse(rawText) as KimiChatResponse;
  } catch {
    return NextResponse.json(
      { error: "Respuesta inválida de Kimi.", detail: rawText.slice(0, 200) },
      { status: 502 }
    );
  }

  if (!kimiRes.ok) {
    const msg =
      payload.error?.message ||
      `Kimi respondió ${kimiRes.status}. Revisa créditos o la API key.`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return NextResponse.json(
      { error: "Kimi no devolvió contenido." },
      { status: 502 }
    );
  }

  let fields: ScanLabelFields;
  try {
    fields = parseScanLabelResult(extractJsonObject(content));
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "No se pudo interpretar la respuesta.",
        detail: content.slice(0, 400),
      },
      { status: 502 }
    );
  }

  if (!fields.name) {
    return NextResponse.json(
      {
        error:
          fields.notes ||
          "No pude leer un vino en esa foto. Prueba con más luz y la etiqueta de frente.",
        fields,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ fields });
}
