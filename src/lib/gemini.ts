import type { KimiTokenUsage } from "@/lib/kimi-usage";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type LlmProvider = "gemini" | "kimi";

export type ResolvedLlm = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
};

/** Prefer Gemini when configured; otherwise Kimi. */
export function resolvePrimaryLlm(): ResolvedLlm | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite",
    };
  }
  const kimiKey = process.env.KIMI_API_KEY?.trim();
  if (kimiKey) {
    return {
      provider: "kimi",
      apiKey: kimiKey,
      model: process.env.KIMI_MODEL?.trim() || "kimi-k2.6",
    };
  }
  return null;
}

/** Optional Kimi fallback when Gemini is primary but fails. */
export function resolveKimiFallback(): ResolvedLlm | null {
  const kimiKey = process.env.KIMI_API_KEY?.trim();
  if (!kimiKey) return null;
  return {
    provider: "kimi",
    apiKey: kimiKey,
    model: process.env.KIMI_MODEL?.trim() || "kimi-k2.6",
  };
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponsePart = {
  text?: string;
  /** Present on thinking-model scratch parts — must not be parsed as JSON. */
  thought?: boolean;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiResponsePart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; status?: string; code?: number };
};

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) {
    throw new Error("Imagen inválida (se esperaba data:image/...;base64).");
  }
  return { mimeType: m[1], data: m[2] };
}

function parseGeminiUsage(payload: GeminiResponse): KimiTokenUsage | null {
  const u = payload.usageMetadata;
  if (!u) return null;
  const prompt = Math.max(0, Math.floor(u.promptTokenCount ?? 0));
  const completion = Math.max(0, Math.floor(u.candidatesTokenCount ?? 0));
  let total = Math.max(0, Math.floor(u.totalTokenCount ?? 0));
  if (total === 0 && (prompt > 0 || completion > 0)) total = prompt + completion;
  if (prompt === 0 && completion === 0 && total === 0) return null;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
  };
}

function isGemini3Family(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes("gemini-3") ||
    m.includes("gemini-flash-latest") ||
    m.includes("gemini-flash-lite-latest") ||
    m.includes("gemini-omni")
  );
}

function isGeminiFlashLite(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes("flash-lite") || m.includes("lite-latest");
}

/**
 * Lite models: disable thinking (thinkingBudget 0) so output budget isn't eaten.
 * Other Gemini 3: thinkingLevel minimal. Gemini 2.5: thinkingBudget 0.
 */
function thinkingConfigForModel(model: string): Record<string, unknown> {
  if (isGeminiFlashLite(model) || !isGemini3Family(model)) {
    return { thinkingBudget: 0 };
  }
  return { thinkingLevel: "minimal" };
}

function looksLikeCompleteJsonObject(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("{") || !t.includes("}")) return false;
  // Cheap structural check: braces net to zero and ends with }/]/
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && !inString;
}

/**
 * Gemini generateContent with JSON mime type.
 * `images` are data:image/...;base64,... URLs (optional).
 */
export async function geminiGenerateJson(options: {
  apiKey: string;
  model?: string;
  system: string;
  userText: string;
  images?: string[];
  maxTokens?: number;
  temperature?: number;
  /** OpenAPI-subset schema; strongly improves JSON validity on Flash models. */
  responseSchema?: Record<string, unknown>;
}): Promise<{ content: string; usage: KimiTokenUsage | null }> {
  const model = options.model?.trim() || "gemini-3.1-flash-lite";
  const parts: GeminiPart[] = [];
  for (const url of options.images ?? []) {
    const { mimeType, data } = parseDataUrl(url);
    parts.push({ inlineData: { mimeType, data } });
  }
  parts.push({ text: options.userText });

  const generationConfig: Record<string, unknown> = {
    // Thinking tokens share this budget; keep headroom for full JSON payloads.
    maxOutputTokens: options.maxTokens ?? 4096,
    responseMimeType: "application/json",
    thinkingConfig: thinkingConfigForModel(model),
  };

  // Gemini 3 docs: leave sampling defaults unless you have a reason.
  if (options.temperature != null && !isGemini3Family(model)) {
    generationConfig.temperature = options.temperature;
  } else if (options.temperature != null && isGemini3Family(model)) {
    // Still allow an explicit override (e.g. retry), but prefer low values.
    generationConfig.temperature = options.temperature;
  }

  if (options.responseSchema) {
    generationConfig.responseSchema = options.responseSchema;
  }

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: options.system }],
      },
      contents: [{ role: "user", parts }],
      generationConfig,
    }),
  });

  const rawText = await res.text();
  let payload: GeminiResponse;
  try {
    payload = JSON.parse(rawText) as GeminiResponse;
  } catch {
    throw new Error("Respuesta inválida de Gemini.");
  }

  const usage = parseGeminiUsage(payload);
  if (!res.ok) {
    throw Object.assign(
      new Error(
        payload.error?.message || `Gemini respondió ${res.status}. Revisa la API key o cuotas.`
      ),
      { usage }
    );
  }

  const candidate = payload.candidates?.[0];
  const content = candidate?.content?.parts
    ?.filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!content) {
    throw Object.assign(new Error("Gemini no devolvió contenido."), { usage });
  }
  if (
    candidate?.finishReason === "MAX_TOKENS" &&
    !looksLikeCompleteJsonObject(content)
  ) {
    throw Object.assign(
      new Error("Gemini cortó la respuesta (límite de tokens). Intenta de nuevo."),
      { usage }
    );
  }
  return { content, usage };
}

/** Schema for Contar historia / research-wine JSON. */
export const RESEARCH_WINE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    ratingEvidence: {
      type: "OBJECT",
      properties: {
        craft: {
          type: "STRING",
          enum: ["unknown", "basic", "sound", "fine", "outstanding"],
        },
        people: {
          type: "STRING",
          enum: ["none", "generic", "named", "rich"],
        },
        placeFacts: {
          type: "STRING",
          enum: ["none", "regionOnly", "bottleSpecific", "intimate"],
        },
        tellability: {
          type: "STRING",
          enum: ["none", "mild", "strong", "magnetic"],
        },
        distinctiveness: {
          type: "STRING",
          enum: ["commodity", "typical", "distinct", "rare"],
        },
        agingTier: {
          type: "STRING",
          enum: ["none", "entry", "aged", "reservaPlus"],
        },
        craftCite: { type: "STRING" },
        peopleCite: { type: "STRING" },
        placeCite: { type: "STRING" },
        tellCite: { type: "STRING" },
        distinctCite: { type: "STRING" },
      },
      required: [
        "craft",
        "people",
        "placeFacts",
        "tellability",
        "distinctiveness",
        "agingTier",
      ],
    },
    vivino: { type: "NUMBER", nullable: true },
    price: { type: "NUMBER", nullable: true },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    summary: { type: "STRING" },
    curiosity: { type: "STRING" },
    talkHook: { type: "STRING" },
    pairings: { type: "ARRAY", items: { type: "STRING" } },
    pairingNote: { type: "STRING" },
  },
  required: [
    "ratingEvidence",
    "confidence",
    "summary",
    "curiosity",
    "talkHook",
    "pairings",
    "pairingNote",
  ],
};
