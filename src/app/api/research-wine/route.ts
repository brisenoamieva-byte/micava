import { NextResponse } from "next/server";
import {
  parseKimiResearchFromModelText,
  wineIdentityForResearch,
} from "@/lib/kimi-research";

export const runtime = "nodejs";
export const maxDuration = 60;

const KIMI_BASE = "https://api.moonshot.ai/v1";
const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";

const SYSTEM = `Eres el narrador de Cavatale: conviertes una botella de una cava personal en algo que la gente QUIERE escuchar y contar.

El clic "Contar historia" debe valer la pena. No escribas una ficha de tienda ni un párrafo de Wikipedia sobre la denominación. Escribe como quien acaba de descubrir un secreto y lo comparte en la mesa, con calidez, precisión y un toque de teatro.

Responde SOLO con JSON válido (sin markdown) con estas claves:
vivino, price, confidence, summary, curiosity, talkHook, pairings, pairingNote.

## Qué debe lograr cada campo

- summary (string): LA HISTORIA — 3–5 frases en español. Un arco narrativo sobre ESTA botella (o, si no la conoces bien, sobre lo más concreto que sí puedas: bodega, viñedo, cosecha, familia, lugar). Debe responder: ¿por qué esta botella importa? Incluye al menos un detalle vivo (persona, paisaje, decisión de elaboración, momento histórico, ritual local). Tono íntimo, oral, elegante — nunca catálogo. No empieces con "X es una de las denominaciones más…" ni con definiciones genéricas.

- curiosity (string): EL DATO QUE SE REPITE — 1–2 frases. Un solo hecho sorprendente, específico y verificable en espíritu (anécdota real de bodega, reglamento raro, origen del nombre, cosecha legendaria, uva olvidada, rivalidad, cifra inesperada). Debe hacer que alguien diga "¿en serio?". Prohibido lo obvio ("la Garnacha es una uva tinta", "Francia hace buen vino").

- talkHook (string): EL GANCHO DE MESA — 1 frase (máx. 2). Una pregunta, apuesta o provocación concreta a ESTE vino que abra conversación entre quienes lo beben. Evita preguntas genéricas de cata ("¿notas fruta o madera?", "¿te gusta?"). Mejor: un contraste, un mito a discutir, un "fíjate si…", un "la gente suele… pero…".

- pairings (string[]): 4–6 platillos o momentos de comida CONCRETOS para ESTA botella (México/LatAm cuando encaje). No listas genéricas de uva ("quesos curados" suelto). Mejor: plato con detalle ("cabrito al pastor con salsa de chile seco", "tacos de rib eye y cebolla asada"). Mezcla salado y, si aplica, un postre o quesos.

- pairingNote (string): 1 frase que explique el hilo del maridaje (acidez, cuerpo, especias, tradición local).

## Estimaciones (secundarias; no son el valor del clic)

- vivino (number|null): score típico estilo Vivino 1–5 para ese vino/cosecha si tienes buena certeza; si no, null. No inventes .0/.5 al azar.
- price (number|null): precio menudeo de referencia en MXN (entero) si puedes estimar para México; si no, null.
- confidence: "high" | "medium" | "low" según certeza de identificación y cifras.

## Reglas de oro

1. Específico > general. Si solo conoces la región, cuenta lo más memorable de ESA región/uva/estilo — no relleno genérico.
2. summary, curiosity, talkHook y pairings NO deben repetir la misma idea.
3. No inventes bodegas, personas, premios ni URLs que no conozcas. Si faltan datos, sé honesto y brillante con lo que sí hay.
4. No digas que consultaste Vivino/internet en vivo.
5. Español natural (México/LatAm). Sin emojis. Sin markdown dentro de los strings.`;

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
        // Instant mode: thinking defaults ON and often exceeds mobile/proxy timeouts.
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        max_tokens: 2048,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Esta botella está a punto de abrirse (o regalarse). Dame el descubrimiento que hace que valga la pena: historia con gancho, un dato que la mesa va a repetir, una provocación para conversar, y un maridaje concreto (pairings + pairingNote). Las cifras solo si las conoces bien.

Ficha:\n\n${identity}`,
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
      {
        error: "Respuesta inválida de Kimi.",
        detail: rawText.slice(0, 200),
      },
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
