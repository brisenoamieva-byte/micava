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
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash",
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

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
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
}): Promise<{ content: string; usage: KimiTokenUsage | null }> {
  const model = options.model?.trim() || "gemini-3.5-flash";
  const parts: GeminiPart[] = [];
  for (const url of options.images ?? []) {
    const { mimeType, data } = parseDataUrl(url);
    parts.push({ inlineData: { mimeType, data } });
  }
  parts.push({ text: options.userText });

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: options.system }],
      },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: options.temperature ?? 0.6,
        maxOutputTokens: options.maxTokens ?? 2048,
        responseMimeType: "application/json",
      },
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

  const content = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!content) {
    throw Object.assign(new Error("Gemini no devolvió contenido."), { usage });
  }
  return { content, usage };
}
