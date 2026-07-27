import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import {
  assessKimiStoryQuality,
  buildUserCorrectionPromptBlock,
  normalizeUserCorrectionNote,
  parseKimiResearchFromModelText,
  polishKimiResearchNarratives,
  wineIdentityForResearch,
  type KimiResearch,
} from "@/lib/kimi-research";
import {
  addKimiUsage,
  parseKimiUsage,
  recordKimiUsage,
  type KimiTokenUsage,
} from "@/lib/kimi-usage";
import { captureApiFailure } from "@/lib/sentry-api";

export const runtime = "nodejs";
export const maxDuration = 60;

const KIMI_BASE = "https://api.moonshot.ai/v1";
const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
const USAGE_ROUTE = "research-wine";

const SYSTEM = `Eres el narrador y crítico de Cavatale: conviertes una botella de una cava personal en algo que la gente QUIERE escuchar y contar, y asignas el Rating Cavatale oficial.

El clic "Contar historia" debe valer la pena. Prohibido sonar a ficha de tienda, catálogo Vivino o párrafo de Wikipedia sobre la denominación. Escribe como quien acaba de descubrir un secreto y lo comparte en la mesa: calidez, precisión, un toque de teatro.

Prioridad narrativa (en este orden):
1) LAS PERSONAS — dueños, fundadores, familia, enólogo/a, generaciones. Nombres propios, vínculos (padre/hijo, pareja, inmigrantes, herencia), decisiones humanas o anécdotas íntimas van AL CENTRO.
2) EL LUGAR Y LA BOTELLA — viñedo concreto, cosecha/añada, estilo, por qué importa ESTA botella (no "la región en general").
3) Solo si faltan personas concretas: un detalle humano del proyecto o del paisaje vivido — nunca un folleto genérico de la DO.

Responde SOLO con JSON válido (sin markdown) con estas claves:
cavataleRating, vivino, price, confidence, summary, curiosity, talkHook, pairings, pairingNote.

## Rating Cavatale (OBLIGATORIO cuando tengas base; score oficial de la plataforma)

- cavataleRating (number|null): 1.0–5.0 con UN decimal. NO copies Vivino. NO inventes.
  Juicio: ¿vale la pena en la copa Y en la mesa?

  Ponderación:
  1) Sabor y calidad en copa (~30%)
  2) Historia y autenticidad (~30%)
  3) Experiencia de mesa (~25%)
  4) Originalidad e interés (~15%)

  Lectura: buen sabor + poca historia → ~3.7–4.0; gran historia + sabor flojo → techo ~3.5–3.9; buen sabor + historia + mesa → ~4.2–4.6; excepcional → ≥4.7.
  Sé preciso con décimas. Evita .0/.5 por pereza.
  Identidad dudosa o sin señales serias → null (mejor null que un número flojo).
  NUNCA menciones Vivino ni el score comunitario dentro de summary/curiosity/talkHook/pairingNote. Vivino vive solo en el campo vivino.

## Estimaciones de referencia (secundarias)

- vivino (number|null): mejor estimación del promedio comunitario 1–5 de ESTA botella; si no hay señal, null. Independiente de cavataleRating. Nunca inventes un Vivino “bonito”.
- price (number|null): menudeo de referencia en MXN (entero) para México si puedes; si no, null.
- confidence: "high" | "medium" | "low". "high" SOLO si la identidad es clara Y (si das vivino) la estimación es fiable.

## Campos narrativos — coherencia de UNA sola botella

Los cuatro campos hablan del MISMO vino concreto. Misma bodega, misma gente, mismos hechos. No mezcles datos de otra etiqueta ni inventes para rellenar.

- summary (string): LA HISTORIA ÍNTIMA — 3–5 frases en español MX/LatAm.
  Abre con persona, gesto o detalle vivo de ESTA botella/bodega — NUNCA con denominación, región o tipología ("X es una de las denominaciones más…", "Este tinto de Ribera…", "Se elabora en…").
  Preferencia fuerte: fundador/a, dueños, familia, enólogo/a. Nombres cuando los sepas.
  Si NO conoces personas de ESA bodega: 2–3 frases honestas con lo más concreto que sí sepas (lugar, proyecto, añada). Di la incertidumbre con naturalidad. NO inventes biografías.
  Incluye al menos un detalle concreto (nombre, año, viñedo, decisión, anécdota).
  Prohibido wine-speak vacío: "equilibrio perfecto", "expresión del terroir", "final largo y sedoso", "notas de fruta roja y especias" sin anclaje humano.

- curiosity (string): EL DATO QUE SE REPITE — 1–2 frases. Anecdota de personas o hecho sorprendente del lugar/bodega. Debe hacer decir "¿en serio?". Distinto del summary (no parafrasear). Prohibido lo obvio ("es un tinto de la región").

- talkHook (string): EL GANCHO DE MESA — 1 frase (máx. 2). Provocación sobre gente/historia humana. Evita preguntas de cata ("¿notas fruta o madera?"). Distinto de summary y curiosity.

- pairings (string[]): 4–6 platillos o momentos CONCRETOS para ESTA botella (México/LatAm cuando encaje). No listas genéricas de uva.

- pairingNote (string): 1 frase con el hilo del maridaje. Sin mencionar Vivino ni Cavatale.

## Prohibiciones de apertura (summary)

NO empieces con variantes de:
- "es una de las denominaciones/regiones/bodegas más…"
- "pertenece a la D.O. / denominación de origen…"
- "se elabora en la región de…"
- "conocido por sus vinos/uvas…"
- "este vino es un tinto/blanco de…"
- "representa la esencia/tradición de…"

## Reglas de oro

1. Personas reales > detalle de botella/lugar > marketing de denominación.
2. Nunca inventes dueños, fundadores, enólogos, fechas familiares ni premios.
3. Si la ficha es incompleta o la identidad es dudosa: confidence "low" o "medium", cavataleRating null si hace falta, summary corto y honesto — no rellenes con catálogo.
4. summary, curiosity, talkHook y pairings NO repiten la misma idea.
5. No digas que consultaste Vivino/internet en vivo.
6. Español natural (México/LatAm). Sin emojis. Sin markdown dentro de los strings.`;

const RETRY_USER_SUFFIX = `

REESCRITURA OBLIGATORIA: tu borrador anterior sonaba a ficha de catálogo o era demasiado genérico/delgado.
- Abre summary con una PERSONA o un DETALLE concreto de ESTA botella — nunca con DO/región/tipología.
- curiosity y talkHook deben aportar hechos distintos (no parafrasear el summary).
- Si no conoces gente de esa bodega, dilo en 2–3 frases honestas; no inventes.
- Mantén coherencia: mismos hechos en todos los campos.
- Devuelve SOLO el JSON completo otra vez.`;

const RETRY_ENCOUNTER_SUFFIX = `

REESCRITURA OBLIGATORIA (modo encuentro / mesa esta noche):
- talkHook: exactamente 1 frase oral, provocadora, para decir YA con la copa en la mano. Cero preguntas de cata.
- Abre summary con PERSONA o detalle concreto — nunca DO/región/tipología.
- curiosity y talkHook hechos distintos; sin inventar.
- Devuelve SOLO el JSON completo otra vez.`;

type ResearchMode = "cellar" | "encounter";

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
  /** Owner dispute / report of error — NOT ground truth. */
  userCorrection?: string | null;
  /** Alias of userCorrection. */
  feedback?: string | null;
  /**
   * "encounter" = restaurant table tonight (Encuentro).
   * Bias talkHook toward something you can say out loud with the glass in hand.
   * Default / omit = cellar Contar historia.
   */
  mode?: ResearchMode | string | null;
};

const ENCOUNTER_TALKHOOK_BIAS = `

MODO ENCUENTRO (mesa de esta noche):
Esta consulta viene de un restaurante / mesa ahora — no de una cava en casa.
- talkHook es EL HÉROE: exactamente 1 frase (nunca 2) que se diga EN VOZ ALTA con la copa en la mano.
- Tono: oral, provocador, humano — para esta mesa esta noche. No suena a pregunta de cata ni a tip genérico de sommelier.
- Preferí: un secreto de gente, una decisión íntima, un "¿sabían que…?" anclado en hechos reales de ESTA botella.
- Prohibido: "¿notas…?", "busca aromas de…", "ideal para maridar con…", preguntas de degustación, ganchos genéricos de región/DO.
- summary y curiosity siguen siendo el relato completo; talkHook es lo que se lanza primero a la mesa.`;

function resolveMode(raw: Body["mode"]): ResearchMode {
  const m = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return m === "encounter" || m === "encuentro" ? "encounter" : "cellar";
}

type KimiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function buildUserPrompt(identity: string, mode: ResearchMode): string {
  const talkHookHint =
    mode === "encounter"
      ? "talkHook (1 frase oral para decir YA en esta mesa, con la copa en la mano — provocación humana, no cata)"
      : "talkHook (provocación de mesa)";

  const opener =
    mode === "encounter"
      ? "Esta botella está en la mesa AHORA (restaurante / cena). Prioriza a las personas detrás del vino (fundadores, dueños, familia, enólogo/a) si las conoces; si no, sé honesto y cuenta lo más íntimo y concreto que sí sepas — sin inventar."
      : "Esta botella está a punto de abrirse (o regalarse). Prioriza a las personas detrás del vino (fundadores, dueños, familia, enólogo/a) si las conoces; si no, sé honesto y cuenta lo más íntimo y concreto que sí sepas — sin inventar.";

  return `${opener}

Dame JSON con: Rating Cavatale (~30% sabor/calidad en copa, ~30% historia/autenticidad, ~25% experiencia de mesa, ~15% originalidad/interés), summary (historia íntima; NUNCA abrir con denominación/región genérica), curiosity (dato que se repite), ${talkHookHint}, pairings + pairingNote, y estimaciones vivino/price solo si las conoces bien. No metas Vivino en los textos narrativos.
${mode === "encounter" ? ENCOUNTER_TALKHOOK_BIAS : ""}
Ficha:\n\n${identity}`;
}

async function callKimi(
  apiKey: string,
  userContent: string
): Promise<
  | { ok: true; content: string; usage: KimiTokenUsage | null }
  | { ok: false; status: number; error: string; detail?: string; usage: KimiTokenUsage | null }
> {
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
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch {
    return {
      ok: false,
      status: 502,
      error: "No se pudo contactar a la IA. Revisa la conexión e intenta de nuevo.",
      usage: null,
    };
  }

  const rawText = await kimiRes.text();
  let payload: KimiChatResponse;
  try {
    payload = JSON.parse(rawText) as KimiChatResponse;
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Respuesta inválida de Kimi.",
      detail: rawText.slice(0, 200),
      usage: null,
    };
  }

  const usage = parseKimiUsage(payload);

  if (!kimiRes.ok) {
    return {
      ok: false,
      status: 502,
      error:
        payload.error?.message ||
        `Kimi respondió ${kimiRes.status}. Revisa créditos o la API key.`,
      usage,
    };
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return {
      ok: false,
      status: 502,
      error: "Kimi no devolvió contenido.",
      usage,
    };
  }
  return { ok: true, content, usage };
}

function finalizeResearch(content: string): {
  research: Omit<KimiResearch, "kimiCheckedAt">;
  thinStory: boolean;
  shouldRetry: boolean;
} {
  const parsed = polishKimiResearchNarratives(
    parseKimiResearchFromModelText(content)
  );
  const quality = assessKimiStoryQuality(parsed);
  return {
    research: parsed,
    thinStory: quality.thin,
    shouldRetry: quality.shouldRetry,
  };
}

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

  const correctionRaw = body.userCorrection ?? body.feedback ?? null;
  let correctionNote: string | null = null;
  if (correctionRaw != null && String(correctionRaw).trim()) {
    const checked = normalizeUserCorrectionNote(String(correctionRaw));
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    correctionNote = checked.note;
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

  const mode = resolveMode(body.mode);
  const correctionBlock = correctionNote
    ? buildUserCorrectionPromptBlock(correctionNote)
    : "";
  const userPrompt = buildUserPrompt(identity, mode) + correctionBlock;
  const first = await callKimi(apiKey, userPrompt);
  let sessionUsage: KimiTokenUsage | null = first.usage;

  if (!first.ok) {
    captureApiFailure(USAGE_ROUTE, "kimi_upstream", first.error, first.status);
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: MODEL,
      usage: sessionUsage,
    });
    return NextResponse.json(
      { error: first.error, detail: first.detail },
      { status: first.status }
    );
  }

  let finalized: ReturnType<typeof finalizeResearch>;
  try {
    finalized = finalizeResearch(first.content);
  } catch (e) {
    captureApiFailure(USAGE_ROUTE, "parse_research", e, 502);
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
            : "No se pudo interpretar la historia. Reintenta.",
        detail: first.content.slice(0, 400),
      },
      { status: 502 }
    );
  }

  if (finalized.shouldRetry) {
    const retrySuffix =
      mode === "encounter" ? RETRY_ENCOUNTER_SUFFIX : RETRY_USER_SUFFIX;
    const second = await callKimi(apiKey, userPrompt + retrySuffix);
    sessionUsage = addKimiUsage(sessionUsage, second.usage);
    if (second.ok) {
      try {
        const retry = finalizeResearch(second.content);
        // Prefer the less thin rewrite; fall back to first if retry is worse.
        if (!retry.thinStory || finalized.thinStory) {
          finalized = retry;
        }
      } catch {
        /* keep first */
      }
    }
  }

  await recordKimiUsage({
    userId: guard.userId,
    route: USAGE_ROUTE,
    model: MODEL,
    usage: sessionUsage,
  });

  const research = {
    ...finalized.research,
    kimiCheckedAt: new Date().toISOString(),
  };
  return NextResponse.json({
    research,
    thinStory: finalized.thinStory,
  });
}
