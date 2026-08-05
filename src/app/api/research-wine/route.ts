import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import {
  assessKimiStoryQuality,
  buildUserCorrectionPromptBlock,
  normalizeUserCorrectionNote,
  parseKimiResearchFromModelText,
  polishKimiResearchNarratives,
  resolveOfficialCavataleRating,
  wineIdentityForResearch,
  type KimiResearch,
} from "@/lib/kimi-research";
import {
  parseKimiUsage,
  recordKimiUsage,
  type KimiTokenUsage,
} from "@/lib/kimi-usage";

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
ratingParts, cavataleRating, vivino, price, confidence, summary, curiosity, talkHook, pairings, pairingNote.

## Rating Cavatale (score oficial — preciso, no improvisado)

NO inventes un decimal “a ojo”. Primero califica CUATRO ejes en medios puntos (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5):

ratingParts (objeto OBLIGATORIO si la identidad es clara):
- taste: sabor/calidad en copa (¿está bien hecho el vino?)
- story: historia y autenticidad humana (personas, proyecto, honestidad del relato)
- table: experiencia de mesa (¿abre conversación, interesa contarlo?)
- originality: originalidad e interés (poco común, ángulo propio, no genérico)

Anclas (sé disciplinado; no regales 4.5+):
- 2–2.5: flojo / dudoso / genérico
- 3–3.5: correcto, sin gran gancho
- 3.5–4: bueno en copa O en historia, no excepcional en ambos
- 4–4.5: muy bueno en copa Y con historia/mesa real
- 4.5–5: excepcional y memorable (raro; reserva para casos claros)

cavataleRating: puedes incluirlo, pero el servidor lo RECALCULA así:
  0.30*taste + 0.30*story + 0.25*table + 0.15*originality (un decimal).
Identidad dudosa o sin señales serias → ratingParts null y cavataleRating null.
Si la ficha ya trae "Rating Cavatale guardado": NO recalcules. Devuelve ese mismo número en cavataleRating y ratingParts puede ir null.
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
6. Idioma natural (México/LatAm por defecto). Sin emojis. Sin markdown dentro de los strings.`;

const LANG_ES = `

IDIOMA DE SALIDA (obligatorio):
Escribe summary, curiosity, talkHook, pairingNote y cada ítem de pairings en español natural (México/LatAm).`;

const LANG_EN = `

OUTPUT LANGUAGE (required):
Write summary, curiosity, talkHook, pairingNote, and every pairings item in natural English (US/international wine table tone). Keep dish names concrete; Mexican/LatAm dishes are fine when they fit. Do not write Spanish in those fields.`;

function resolveLocale(raw: Body["locale"]): "es" | "en" {
  const m = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return m === "en" || m.startsWith("en-") ? "en" : "es";
}

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
  /** Force a new official score even if one is already stored. */
  recalculateRating?: boolean;
  /** UI locale: "en" | "es" (default es). Narratives follow this language. */
  locale?: string | null;
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

function buildUserPrompt(
  identity: string,
  mode: ResearchMode,
  opts: { ratingLocked: boolean }
): string {
  const talkHookHint =
    mode === "encounter"
      ? "talkHook (1 frase oral para decir YA en esta mesa, con la copa en la mano — provocación humana, no cata)"
      : "talkHook (provocación de mesa)";

  const opener =
    mode === "encounter"
      ? "Esta botella está en la mesa AHORA (restaurante / cena). Prioriza a las personas detrás del vino (fundadores, dueños, familia, enólogo/a) si las conoces; si no, sé honesto y cuenta lo más íntimo y concreto que sí sepas — sin inventar."
      : "Esta botella está a punto de abrirse (o regalarse). Prioriza a las personas detrás del vino (fundadores, dueños, familia, enólogo/a) si las conoces; si no, sé honesto y cuenta lo más íntimo y concreto que sí sepas — sin inventar.";

  if (opts.ratingLocked) {
    return `${opener}

MODO SOLO HISTORIA: esta botella YA tiene Rating Cavatale oficial guardado.
- Reescribe summary, curiosity, ${talkHookHint}, pairings y pairingNote.
- cavataleRating: copia EXACTAMENTE el "Rating Cavatale guardado" de la ficha.
- ratingParts: null (no recalcules ejes).
- Puedes actualizar vivino/price solo si estás seguro; si no, null.
No metas Vivino en los textos narrativos.
${mode === "encounter" ? ENCOUNTER_TALKHOOK_BIAS : ""}
Ficha:\n\n${identity}`;
  }

  return `${opener}

Dame JSON con:
1) ratingParts {taste, story, table, originality} en MEDIOS PUNTOS (1–5). Sé estricto con las anclas; no regales notas altas.
2) cavataleRating (el servidor lo recalcula con 30/30/25/15; puedes poner tu estimado).
3) summary (historia íntima; NUNCA abrir con denominación/región genérica), curiosity, ${talkHookHint}, pairings + pairingNote.
4) vivino/price solo si los conoces bien.
No metas Vivino en los textos narrativos.
${mode === "encounter" ? ENCOUNTER_TALKHOOK_BIAS : ""}
Ficha:\n\n${identity}`;
}

function finalizeResearch(content: string): {
  research: Omit<KimiResearch, "kimiCheckedAt">;
  thinStory: boolean;
  ratingParts: ReturnType<typeof parseKimiResearchFromModelText>["ratingParts"];
} {
  const parsed = polishKimiResearchNarratives(
    parseKimiResearchFromModelText(content)
  );
  const { ratingParts, ...research } = parsed;
  const quality = assessKimiStoryQuality(research);
  return {
    research,
    thinStory: quality.thin,
    ratingParts,
  };
}

async function callKimi(
  apiKey: string,
  userContent: string,
  locale: "es" | "en"
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
          {
            role: "system",
            content: SYSTEM + (locale === "en" ? LANG_EN : LANG_ES),
          },
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
  const locale = resolveLocale(body.locale);
  const forceRecalculate = Boolean(body.recalculateRating);
  const existingRating =
    body.cavataleRating != null && Number.isFinite(body.cavataleRating)
      ? body.cavataleRating
      : null;
  const ratingLocked = existingRating != null && !forceRecalculate;
  const correctionBlock = correctionNote
    ? buildUserCorrectionPromptBlock(correctionNote)
    : "";
  const userPrompt =
    buildUserPrompt(identity, mode, { ratingLocked }) + correctionBlock;
  const first = await callKimi(apiKey, userPrompt, locale);
  let sessionUsage: KimiTokenUsage | null = first.usage;

  if (!first.ok) {
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

  // Official score: weighted axes on first pass; sticky afterward (unless recalculate).
  const officialRating = resolveOfficialCavataleRating({
    existing: existingRating,
    forceRecalculate,
    parts: finalized.ratingParts,
    modelRating: finalized.research.cavataleRating,
  });

  await recordKimiUsage({
    userId: guard.userId,
    route: USAGE_ROUTE,
    model: MODEL,
    usage: sessionUsage,
  });

  const research = {
    ...finalized.research,
    cavataleRating: officialRating,
    kimiCheckedAt: new Date().toISOString(),
  };
  return NextResponse.json({
    research,
    thinStory: finalized.thinStory,
    ratingLocked: ratingLocked && !forceRecalculate,
  });
}
