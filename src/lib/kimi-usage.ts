import { createClient } from "@/lib/supabase/server";

/** Moonshot Kimi K2.6 list prices (USD per 1M tokens). */
export const KIMI_PRICE_IN_PER_M = 0.95;
export const KIMI_PRICE_OUT_PER_M = 4.0;

export type KimiTokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type KimiUsageLike = {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
};

export function parseKimiUsage(payload: KimiUsageLike | null | undefined): KimiTokenUsage | null {
  const u = payload?.usage;
  if (!u || typeof u !== "object") return null;

  const prompt = asNonNegInt(u.prompt_tokens ?? u.promptTokens);
  const completion = asNonNegInt(u.completion_tokens ?? u.completionTokens);
  let total = asNonNegInt(u.total_tokens ?? u.totalTokens);
  if (total === 0 && (prompt > 0 || completion > 0)) {
    total = prompt + completion;
  }
  if (prompt === 0 && completion === 0 && total === 0) return null;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
}

export function addKimiUsage(
  a: KimiTokenUsage | null | undefined,
  b: KimiTokenUsage | null | undefined
): KimiTokenUsage | null {
  if (!a && !b) return null;
  return {
    prompt_tokens: (a?.prompt_tokens ?? 0) + (b?.prompt_tokens ?? 0),
    completion_tokens: (a?.completion_tokens ?? 0) + (b?.completion_tokens ?? 0),
    total_tokens: (a?.total_tokens ?? 0) + (b?.total_tokens ?? 0),
  };
}

export function estimateKimiUsd(usage: {
  prompt_tokens: number;
  completion_tokens: number;
}): number {
  return (
    (usage.prompt_tokens / 1_000_000) * KIMI_PRICE_IN_PER_M +
    (usage.completion_tokens / 1_000_000) * KIMI_PRICE_OUT_PER_M
  );
}

/**
 * Best-effort persist of one successful Kimi call (or aggregated loop).
 * Never throws; metering must not break the user-facing route.
 */
export async function recordKimiUsage(options: {
  userId: string | null | undefined;
  route: string;
  model: string;
  usage: KimiTokenUsage | null | undefined;
}): Promise<void> {
  const { userId, route, model, usage } = options;
  if (!userId || !usage) return;
  if (
    usage.prompt_tokens <= 0 &&
    usage.completion_tokens <= 0 &&
    usage.total_tokens <= 0
  ) {
    return;
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("kimi_usage_events").insert({
      user_id: userId,
      route: route.slice(0, 80),
      model: model.slice(0, 80),
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
    });
    if (error) {
      // Missing table / RLS until migration is applied — silent for MVP.
      console.warn("[kimi-usage] insert failed:", error.message);
    }
  } catch (e) {
    console.warn(
      "[kimi-usage] record failed:",
      e instanceof Error ? e.message : "unknown"
    );
  }
}

function asNonNegInt(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}
