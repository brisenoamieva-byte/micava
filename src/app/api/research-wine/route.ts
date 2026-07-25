import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import {
  parseKimiResearchFromModelText,
  wineIdentityForResearch,
} from "@/lib/kimi-research";

export const runtime = "nodejs";
export const maxDuration = 60;

const KIMI_BASE = "https://api.moonshot.ai/v1";
const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";

const SYSTEM = `Eres el narrador y crítico de Cavatale: conviertes una botella de una cava personal en algo que la gente QUIERE escuchar y contar, y asignas el Rating Cavatale oficial.

El clic "Contar historia" debe valer la pena. No escribas una ficha de tienda ni un párrafo de Wikipedia sobre la denominación. Escribe como quien acaba de descubrir un secreto y lo comparte en la mesa, con calidez, precisión y un toque de teatro.

Prioridad narrativa (en este orden):
1) LAS PERSONAS — dueños, fundadores, familia, enólogo/a, generaciones que cuidan el viñedo. Si conoces nombres, vínculos (padre/hijo, pareja, inmigrantes, herencia), decisiones humanas o anécdotas íntimas, PONLAS EN EL CENTRO de la historia.
2) EL LUGAR Y LA BOTELLA — viñedo, cosecha, estilo, por qué importa ESTA botella.
3) Solo si faltan personas concretas: región/uva/estilo con el detalle más humano posible (tradición local, ritual, paisaje vivido) — nunca un folleto genérico de la DO.

Responde SOLO con JSON válido (sin markdown) con estas claves:
cavataleRating, vivino, price, confidence, summary, curiosity, talkHook, pairings, pairingNote.

## Rating Cavatale (OBLIGATORIO cuando tengas base; es el score oficial de la plataforma)

- cavataleRating (number|null): puntuación oficial Cavatale en escala 1.0–5.0 con UN decimal.
  NO copies Vivino. NO inventes. Es el juicio Cavatale: ¿qué tan vale la pena esta botella para CONTAR y VIVIR en la mesa?

  Ponderación (aprox.; la historia pesa más que el score de crítica):
  1) Historia que se puede contar (~35%): personas, origen, anécdotas, riesgo, herencia, decisión humana detrás del vino.
  2) Experiencia de mesa (~20%): cómo abre conversación, ritual, emoción al descorchar, sentido de ocasión.
  3) Originalidad (~15%): lo poco obvio, el giro propio, lo que lo distingue de “otro tinto más”.
  4) Autenticidad (~15%): honestidad del proyecto (no postureo), tipicidad vivida, coherencia con lugar/gente.
  5) Interés / rareza narrativa (~10%): dato que hace decir “¿en serio?”, curiosidad real.
  6) Calidad sensorial / reputación técnica (~5%): solo como suelo mínimo; NO debe dominar el número.

  Un vino técnicamente correcto pero sin historia ni carácter no debe puntuar alto.
  Un vino con historia humana fuerte, original y auténtica puede superar a uno “mejor puntuado” en Vivino.
  Sé preciso con las décimas (4.2 ≠ 4.3 ≠ 4.4). Evita .0/.5 por pereza.
  Anclas Cavatale: ~3.4 correcto pero olvidable; ~3.8 agradable con algo que contar; ~4.1–4.3 historia + experiencia notables; ~4.4–4.6 muy memorable; ≥4.7 excepcional en relato y autenticidad.
  Si la identidad es dudosa o no hay señales serias → null (mejor null que un número flojo).

## Estimaciones de referencia (secundarias)

- vivino (number|null): estimación del score comunitario Vivino 1–5 si tienes buena certeza; si no, null. Independiente de cavataleRating.
- price (number|null): precio menudeo de referencia en MXN (entero) si puedes estimar para México; si no, null.
- confidence: "high" | "medium" | "low" según certeza de identificación, personas, cavataleRating y cifras.

## Qué debe lograr cada campo narrativo

- summary (string): LA HISTORIA ÍNTIMA — 3–5 frases en español. Preferencia fuerte: quién está detrás (fundador/a, dueños actuales, familia, enólogo/a). Nombres propios cuando los sepas. Debe sentir que hay alguien real detrás del corcho. Si no conoces personas de ESA bodega/vino, dilo con honestidad breve y cuenta lo más concreto que sí sepas del proyecto o del lugar — sin inventar biografías. Incluye al menos un detalle vivo. Tono íntimo, oral, elegante — nunca catálogo. No empieces con "X es una de las denominaciones más…" ni con definiciones genéricas.

- curiosity (string): EL DATO QUE SE REPITE — 1–2 frases. Idealmente una anécdota de personas (cómo empezaron, un riesgo, un nombre del vino, una rivalidad, una cosecha que marcaron). Si no hay dato humano fiable, un hecho sorprendente del lugar/bodega. Debe hacer decir "¿en serio?". Prohibido lo obvio.

- talkHook (string): EL GANCHO DE MESA — 1 frase (máx. 2). Preferible una provocación sobre la gente o la historia humana del vino ("¿quién crees que manda en esa bodega…?", "esta botella empezó por…"). Evita preguntas genéricas de cata ("¿notas fruta o madera?").

- pairings (string[]): 4–6 platillos o momentos de comida CONCRETOS para ESTA botella (México/LatAm cuando encaje). No listas genéricas de uva. Mejor: plato con detalle.

- pairingNote (string): 1 frase que explique el hilo del maridaje.

## Reglas de oro

1. Personas reales > paisaje genérico > marketing de denominación.
2. Nunca inventes dueños, fundadores, enólogos, fechas familiares ni premios. Si no los conoces, no los fabriques.
3. cavataleRating privilegia historia, experiencia, originalidad, autenticidad e interés — no el ranking comunitario.
4. summary, curiosity, talkHook y pairings NO deben repetir la misma idea.
5. No digas que consultaste Vivino/internet en vivo.
6. Español natural (México/LatAm). Sin emojis. Sin markdown dentro de los strings.`;

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
  cavataleRating?: number | null;
  price?: number | null;
};

type KimiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  const guard = await guardKimiApi(request);
  if (!guard.ok) return guard.response;

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
    cavataleRating: body.cavataleRating ?? null,
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
            content: `Esta botella está a punto de abrirse (o regalarse). Prioriza a las personas detrás del vino (fundadores, dueños, familia, enólogo/a) si las conoces; si no, sé honesto y cuenta lo más íntimo y concreto que sí sepas. Dame: Rating Cavatale ponderando sobre todo historia contable, experiencia de mesa, originalidad, autenticidad e interés (la calidad técnica solo como suelo), más historia, dato que la mesa repetirá, provocación para conversar, maridaje (pairings + pairingNote), y estimaciones Vivino/precio solo si las conoces bien.

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
