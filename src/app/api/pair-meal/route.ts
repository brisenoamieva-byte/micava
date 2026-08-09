import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import {
  geminiGenerateJson,
  resolveKimiFallback,
  resolvePrimaryLlm,
} from "@/lib/gemini";
import {
  addKimiUsage,
  parseKimiUsage,
  recordKimiUsage,
  type KimiTokenUsage,
} from "@/lib/kimi-usage";
import { resolveMarketGeoFromRequest } from "@/lib/market-geo";
import {
  buildPairMealSystemPrompt,
  buildPairMealUserPrompt,
  normalizeDishDescription,
  PAIR_MEAL_RESPONSE_SCHEMA,
  parsePairMealFromModelText,
  type PairMealWineInput,
} from "@/lib/pair-meal";

export const runtime = "nodejs";
export const maxDuration = 60;

const KIMI_BASE = "https://api.moonshot.ai/v1";
const KIMI_MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
const USAGE_ROUTE = "pair-meal";

type Body = {
  dish?: string;
  locale?: string;
  countryCode?: string | null;
  marketCountry?: string | null;
  wines?: PairMealWineInput[];
};

type KimiChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
};

function resolveLocale(raw: Body["locale"]): "es" | "en" {
  const m = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return m === "en" || m.startsWith("en-") ? "en" : "es";
}

function normalizeWineRows(raw: unknown): PairMealWineInput[] {
  if (!Array.isArray(raw)) return [];
  const out: PairMealWineInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!id || !name) continue;
    out.push({
      id,
      name,
      winery: typeof o.winery === "string" ? o.winery : "",
      country: typeof o.country === "string" ? o.country : "",
      region: typeof o.region === "string" ? o.region : "",
      type: typeof o.type === "string" ? o.type : "",
      grape: typeof o.grape === "string" ? o.grape : "",
      aging: typeof o.aging === "string" ? o.aging : "",
      vintage:
        typeof o.vintage === "number" && Number.isFinite(o.vintage)
          ? o.vintage
          : null,
      cavataleRating:
        typeof o.cavataleRating === "number" && Number.isFinite(o.cavataleRating)
          ? o.cavataleRating
          : null,
      slot: typeof o.slot === "string" ? o.slot : null,
      knownPairings: Array.isArray(o.knownPairings)
        ? o.knownPairings
            .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
            .slice(0, 4)
        : null,
    });
    if (out.length >= 90) break;
  }
  return out;
}

async function callPairLlm(
  llm: { provider: "gemini" | "kimi"; apiKey: string; model: string },
  system: string,
  userText: string
): Promise<
  | { ok: true; content: string; usage: KimiTokenUsage | null }
  | { ok: false; error: string; usage: KimiTokenUsage | null }
> {
  if (llm.provider === "gemini") {
    try {
      const out = await geminiGenerateJson({
        apiKey: llm.apiKey,
        model: llm.model,
        system,
        userText,
        maxTokens: 2048,
        temperature: 0.4,
        responseSchema: PAIR_MEAL_RESPONSE_SCHEMA,
      });
      return { ok: true, content: out.content, usage: out.usage };
    } catch (e) {
      const usage =
        e && typeof e === "object" && "usage" in e
          ? ((e as { usage?: KimiTokenUsage | null }).usage ?? null)
          : null;
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "No se pudo contactar a la IA. Revisa la conexión e intenta de nuevo.",
        usage,
      };
    }
  }

  let kimiRes: Response;
  try {
    kimiRes = await fetch(`${KIMI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llm.model || KIMI_MODEL,
        thinking: { type: "disabled" },
        temperature: 0.4,
        response_format: { type: "json_object" },
        max_tokens: 2048,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText },
        ],
      }),
    });
  } catch {
    return {
      ok: false,
      error: "No se pudo contactar a la IA. Revisa la conexión e intenta de nuevo.",
      usage: null,
    };
  }

  const rawText = await kimiRes.text();
  let payload: KimiChatResponse;
  try {
    payload = JSON.parse(rawText) as KimiChatResponse;
  } catch {
    return { ok: false, error: "Respuesta inválida de Kimi.", usage: null };
  }
  const usage = parseKimiUsage(payload);
  if (!kimiRes.ok) {
    return {
      ok: false,
      error:
        payload.error?.message ||
        `Kimi respondió ${kimiRes.status}. Revisa créditos o la API key.`,
      usage,
    };
  }
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { ok: false, error: "Kimi no devolvió contenido.", usage };
  }
  return { ok: true, content, usage };
}

export async function POST(request: Request) {
  const guard = await guardKimiApi(request);
  if (!guard.ok) return guard.response;

  const llm = resolvePrimaryLlm();
  if (!llm) {
    return NextResponse.json(
      { error: "Falta GEMINI_API_KEY o KIMI_API_KEY en el servidor." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const dish = normalizeDishDescription(body.dish ?? "");
  if (!dish) {
    return NextResponse.json(
      { error: "Cuéntame qué vas a comer (al menos unas palabras)." },
      { status: 400 }
    );
  }

  const wines = normalizeWineRows(body.wines);
  if (wines.length === 0) {
    return NextResponse.json(
      { error: "Tu cava está vacía. Agrega botellas primero." },
      { status: 400 }
    );
  }

  const locale = resolveLocale(body.locale);
  const market = resolveMarketGeoFromRequest(
    request,
    body.countryCode ?? body.marketCountry ?? null
  );
  const system = buildPairMealSystemPrompt(locale);
  const userText = buildPairMealUserPrompt(dish, wines, market.marketLabel);
  const allowedIds = new Set(wines.map((w) => w.id));

  let sessionUsage: KimiTokenUsage | null = null;
  let first = await callPairLlm(llm, system, userText);
  sessionUsage = addKimiUsage(sessionUsage, first.usage);

  let content: string | null = first.ok ? first.content : null;
  if (!content && llm.provider === "gemini") {
    const kimi = resolveKimiFallback();
    if (kimi) {
      const fallback = await callPairLlm(kimi, system, userText);
      sessionUsage = addKimiUsage(sessionUsage, fallback.usage);
      if (fallback.ok) content = fallback.content;
      else if (!first.ok) {
        await recordKimiUsage({
          userId: guard.userId,
          route: USAGE_ROUTE,
          model: llm.model,
          usage: sessionUsage,
        });
        return NextResponse.json(
          { error: first.error || fallback.error },
          { status: 502 }
        );
      }
    } else if (!first.ok) {
      await recordKimiUsage({
        userId: guard.userId,
        route: USAGE_ROUTE,
        model: llm.model,
        usage: sessionUsage,
      });
      return NextResponse.json({ error: first.error }, { status: 502 });
    }
  } else if (!first.ok) {
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: llm.model,
      usage: sessionUsage,
    });
    return NextResponse.json({ error: first.error }, { status: 502 });
  }

  if (!content) {
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: llm.model,
      usage: sessionUsage,
    });
    return NextResponse.json(
      { error: "La IA no devolvió una recomendación." },
      { status: 502 }
    );
  }

  try {
    const recommendation = parsePairMealFromModelText(content, allowedIds);
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: llm.model,
      usage: sessionUsage,
    });
    return NextResponse.json({
      recommendation,
      dish,
      market: { countryCode: market.countryCode, marketLabel: market.marketLabel },
      provider: llm.provider,
    });
  } catch (e) {
    // One retry with a stricter reminder, then fail.
    const retryUser =
      userText +
      `\n\nIMPORTANTE: wineId DEBE ser exactamente uno de los id de la lista. JSON válido únicamente.`;
    const retry = await callPairLlm(llm, system, retryUser);
    sessionUsage = addKimiUsage(sessionUsage, retry.usage);
    if (retry.ok) {
      try {
        const recommendation = parsePairMealFromModelText(
          retry.content,
          allowedIds
        );
        await recordKimiUsage({
          userId: guard.userId,
          route: USAGE_ROUTE,
          model: llm.model,
          usage: sessionUsage,
        });
        return NextResponse.json({
          recommendation,
          dish,
          market: {
            countryCode: market.countryCode,
            marketLabel: market.marketLabel,
          },
          provider: llm.provider,
        });
      } catch {
        /* fall through */
      }
    }
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
            : "No se pudo interpretar la recomendación.",
        detail: content.slice(0, 400),
      },
      { status: 502 }
    );
  }
}
