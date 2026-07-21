import { NextResponse } from "next/server";
import {
  parseKimiResearchFromModelText,
  wineIdentityForResearch,
} from "@/lib/kimi-research";

export const runtime = "nodejs";
export const maxDuration = 60;

const KIMI_BASE = "https://api.moonshot.ai/v1";
const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";

const SYSTEM = `Eres un experto en el mercado de vinos (Vivino, precios en México/LATAM y Europa).
Te dan la ficha de un vino de una cava personal. Estimas calificación y precio de referencia.

Responde SOLO con JSON válido (sin markdown) con estas claves:
vivino, price, confidence, summary.

Reglas:
- vivino (number|null): calificación típica estilo Vivino 1–5 para ese vino (y cosecha si aplica). Si no lo conoces con suficiente certeza, null. No inventes scores redondos al azar.
- price (number|null): precio de referencia al menudeo en MXN (entero). Usa conocimiento de precios típicos en México cuando puedas; si no, null.
- confidence: "high" | "medium" | "low" según certeza de la identificación y de las cifras.
- summary (string): 1–3 frases en español. Compara con los valores guardados si los hay (¿parecen altos/bajos/razonables?). Menciona fuentes de conocimiento (p. ej. "suele rondar 4.1 en Vivino") sin inventar URLs.

No digas que consultaste Vivino en vivo: es una estimación por conocimiento.`;

type Body = {
  name?: string;
  winery?: string;
  country?: string;
  region?: string;
  type?: string;
  grape?: string;
  aging?: string;
  vintage?: number | null;
  vivino?: number | null;
  price?: number | null;
};

type KimiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta KIMI_API_KEY en el servidor." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Falta el nombre del vino." }, { status: 400 });
  }

  const identity = wineIdentityForResearch({
    name,
    winery: body.winery ?? "",
    country: body.country ?? "",
    region: body.region ?? "",
    type: body.type ?? "",
    grape: body.grape ?? "",
    aging: body.aging ?? "",
    vintage: body.vintage ?? null,
    vivino: body.vivino ?? null,
    price: body.price ?? null,
  });

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
        temperature: 1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Investiga/estima calificación y precio para este vino:\n\n${identity}`,
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo contactar a Kimi." },
      { status: 502 }
    );
  }

  const rawText = await kimiRes.text();
  let payload: KimiChatResponse;
  try {
    payload = JSON.parse(rawText) as KimiChatResponse;
  } catch {
    return NextResponse.json(
      { error: "Respuesta inválida de Kimi." },
      { status: 502 }
    );
  }

  if (!kimiRes.ok) {
    return NextResponse.json(
      {
        error:
          payload.error?.message ||
          `Kimi respondió ${kimiRes.status}. Revisa créditos o la API key.`,
      },
      { status: 502 }
    );
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return NextResponse.json(
      { error: "Kimi no devolvió contenido." },
      { status: 502 }
    );
  }

  try {
    const parsed = parseKimiResearchFromModelText(content);
    const research = {
      ...parsed,
      kimiCheckedAt: new Date().toISOString(),
    };
    return NextResponse.json({ research });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "No se pudo interpretar la investigación.",
        detail: content.slice(0, 400),
      },
      { status: 502 }
    );
  }
}
