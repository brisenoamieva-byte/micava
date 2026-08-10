/**
 * Best-effort Kimi `$web_search` tool loop.
 * Official docs warn the builtin is being updated; callers should tolerate failure.
 */

import {
  addKimiUsage,
  parseKimiUsage,
  type KimiTokenUsage,
} from "@/lib/kimi-usage";

const KIMI_BASE = "https://api.moonshot.ai/v1";

type KimiToolCall = {
  id: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

type KimiMessage = {
  role: string;
  content?: string | null | unknown;
  tool_calls?: KimiToolCall[];
  tool_call_id?: string;
  name?: string;
};

type KimiChoice = {
  finish_reason?: string | null;
  message?: KimiMessage;
};

type KimiChatResponse = {
  choices?: KimiChoice[];
  error?: { message?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const WEB_SEARCH_TOOL = {
  type: "builtin_function" as const,
  function: { name: "$web_search" },
};

async function kimiRequest(
  apiKey: string,
  model: string,
  body: Record<string, unknown>
): Promise<KimiChatResponse> {
  const res = await fetch(`${KIMI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const rawText = await res.text();
  let payload: KimiChatResponse;
  try {
    payload = JSON.parse(rawText) as KimiChatResponse;
  } catch {
    throw new Error(`Respuesta inválida de Kimi (${res.status}).`);
  }
  if (!res.ok) {
    throw new Error(
      payload.error?.message || `Kimi respondió ${res.status}.`
    );
  }
  return payload;
}

function messageText(message: KimiMessage | undefined): string | null {
  if (!message) return null;
  const content =
    typeof message.content === "string" ? message.content.trim() : "";
  return content || null;
}

export type KimiWebSearchResult = {
  content: string | null;
  usage: KimiTokenUsage | null;
  /** Set when the loop failed or exhausted without final text. */
  error?: string | null;
};

/**
 * Runs a short chat with `$web_search` until the model returns final text.
 * Returns null content if search is unavailable or the loop fails.
 * Usage is summed across all rounds (including tool-call turns).
 *
 * Important: tool_calls consume a round. After tool results we may need another
 * round for the final answer — callers should set maxRounds >= searches + 1.
 * If the loop still ends on tool_calls, we force one final request without tools.
 */
export async function kimiChatWithWebSearch(options: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxRounds?: number;
  maxTokens?: number;
}): Promise<KimiWebSearchResult> {
  const {
    apiKey,
    model,
    system,
    user,
    maxRounds = 3,
    maxTokens = 2048,
  } = options;

  const messages: KimiMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let usage: KimiTokenUsage | null = null;
  let lastFinish: string | null = null;

  try {
    for (let round = 0; round < maxRounds; round++) {
      const payload = await kimiRequest(apiKey, model, {
        model,
        thinking: { type: "disabled" },
        temperature: 0,
        max_tokens: maxTokens,
        tools: [WEB_SEARCH_TOOL],
        messages,
      });
      usage = addKimiUsage(usage, parseKimiUsage(payload));

      const choice = payload.choices?.[0];
      const message = choice?.message;
      if (!message) {
        return {
          content: null,
          usage,
          error: "Kimi no devolvió mensaje en búsqueda web.",
        };
      }

      const finish = choice.finish_reason ?? "";
      lastFinish = finish;
      if (finish === "tool_calls" && message.tool_calls?.length) {
        messages.push(message);
        for (const call of message.tool_calls) {
          const name = call.function?.name ?? "";
          let args: unknown = {};
          try {
            args = JSON.parse(call.function?.arguments || "{}");
          } catch {
            args = { raw: call.function?.arguments };
          }
          // Builtin: echo arguments; Moonshot executes the search server-side.
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name,
            content: JSON.stringify(
              name === "$web_search" ? args : { error: "unknown tool" }
            ),
          });
        }
        continue;
      }

      const content = messageText(message);
      if (content) return { content, usage, error: null };
      return {
        content: null,
        usage,
        error: "Kimi cerró la búsqueda sin texto final.",
      };
    }

    // Exhausted tool rounds while still mid-search — force a final JSON answer.
    const lastRole = messages[messages.length - 1]?.role;
    if (lastRole === "tool" || lastFinish === "tool_calls") {
      messages.push({
        role: "user",
        content:
          "Ya tienes los resultados de búsqueda. Responde AHORA solo con el JSON final pedido (sin más búsquedas ni markdown).",
      });
      const payload = await kimiRequest(apiKey, model, {
        model,
        thinking: { type: "disabled" },
        max_tokens: maxTokens,
        messages,
      });
      usage = addKimiUsage(usage, parseKimiUsage(payload));
      const content = messageText(payload.choices?.[0]?.message);
      if (content) return { content, usage, error: null };
      return {
        content: null,
        usage,
        error: "Kimi no devolvió JSON tras forzar respuesta final.",
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en búsqueda web Kimi.";
    return { content: null, usage, error: msg };
  }

  return {
    content: null,
    usage,
    error: `Búsqueda web agotó ${maxRounds} rondas sin respuesta final.`,
  };
}
