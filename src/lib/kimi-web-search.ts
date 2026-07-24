/**
 * Best-effort Kimi `$web_search` tool loop.
 * Official docs warn the builtin is being updated; callers should tolerate failure.
 */

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

/**
 * Runs a short chat with `$web_search` until the model returns final text.
 * Returns null if search is unavailable or the loop fails.
 */
export async function kimiChatWithWebSearch(options: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxRounds?: number;
  maxTokens?: number;
}): Promise<string | null> {
  const {
    apiKey,
    model,
    system,
    user,
    maxRounds = 4,
    maxTokens = 2048,
  } = options;

  const messages: KimiMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  try {
    for (let round = 0; round < maxRounds; round++) {
      const payload = await kimiRequest(apiKey, model, {
        model,
        thinking: { type: "disabled" },
        max_tokens: maxTokens,
        tools: [WEB_SEARCH_TOOL],
        messages,
      });

      const choice = payload.choices?.[0];
      const message = choice?.message;
      if (!message) return null;

      const finish = choice.finish_reason ?? "";
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
            content: JSON.stringify(name === "$web_search" ? args : { error: "unknown tool" }),
          });
        }
        continue;
      }

      const content =
        typeof message.content === "string" ? message.content.trim() : "";
      return content || null;
    }
  } catch {
    return null;
  }

  return null;
}
