import { createClient } from "@/lib/supabase/server";

/** Moonshot Kimi K2.6 list prices (USD per 1M tokens). */
export const KIMI_PRICE_IN_PER_M = 0.95;
export const KIMI_PRICE_OUT_PER_M = 4.0;

/**
 * Gemini paid-tier list prices (USD per 1M tokens).
 * https://ai.google.dev/gemini-api/docs/pricing
 * Default app model is Flash-Lite (cheap); keep full Flash rates for legacy events.
 */
export const GEMINI_FLASH_LITE_PRICE_IN_PER_M = 0.25;
export const GEMINI_FLASH_LITE_PRICE_OUT_PER_M = 1.5;
export const GEMINI_FLASH_PRICE_IN_PER_M = 1.5;
export const GEMINI_FLASH_PRICE_OUT_PER_M = 9.0;

export type LlmUsageProvider = "kimi" | "gemini" | "other";

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

export type ProviderUsageTotals = {
  provider: LlmUsageProvider;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
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

/** Infer provider from stored model string (no DB migration required). */
export function providerFromModel(model: string | null | undefined): LlmUsageProvider {
  const m = (model ?? "").trim().toLowerCase();
  if (!m) return "other";
  if (m.includes("gemini")) return "gemini";
  if (m.includes("kimi") || m.includes("moonshot") || m.startsWith("k2")) {
    return "kimi";
  }
  // Legacy default before Gemini wiring was kimi-k2.6
  if (m.includes("k2.6") || m.includes("k2-")) return "kimi";
  return "other";
}

/** Per-1M USD rates for a concrete model id. */
export function ratesForModel(model: string | null | undefined): {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
} {
  const m = (model ?? "").trim().toLowerCase();
  if (m.includes("gemini")) {
    if (m.includes("flash-lite") || m.includes("lite")) {
      // 3.5 Flash-Lite is $0.30/$2.50; 3.1 Flash-Lite (app default) is $0.25/$1.50
      if (m.includes("3.5-flash-lite")) {
        return { inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5 };
      }
      return {
        inputPerMillionUsd: GEMINI_FLASH_LITE_PRICE_IN_PER_M,
        outputPerMillionUsd: GEMINI_FLASH_LITE_PRICE_OUT_PER_M,
      };
    }
    return {
      inputPerMillionUsd: GEMINI_FLASH_PRICE_IN_PER_M,
      outputPerMillionUsd: GEMINI_FLASH_PRICE_OUT_PER_M,
    };
  }
  return {
    inputPerMillionUsd: KIMI_PRICE_IN_PER_M,
    outputPerMillionUsd: KIMI_PRICE_OUT_PER_M,
  };
}

export function estimateUsdForModel(
  model: string | null | undefined,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  const rates = ratesForModel(model);
  return (
    (usage.prompt_tokens / 1_000_000) * rates.inputPerMillionUsd +
    (usage.completion_tokens / 1_000_000) * rates.outputPerMillionUsd
  );
}

export function estimateUsdForProvider(
  provider: LlmUsageProvider,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  // Provider-level estimate uses current defaults (Lite for Gemini, K2.6 for Kimi).
  const model =
    provider === "gemini" ? "gemini-3.1-flash-lite" : "kimi-k2.6";
  return estimateUsdForModel(model, usage);
}

/** @deprecated Prefer estimateUsdForModel — kept for older call sites. */
export function estimateKimiUsd(usage: {
  prompt_tokens: number;
  completion_tokens: number;
}): number {
  return estimateUsdForProvider("kimi", usage);
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function emptyProviderTotals(provider: LlmUsageProvider): ProviderUsageTotals {
  return {
    provider,
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedUsd: 0,
  };
}

export function accumulateProviderUsage(
  into: ProviderUsageTotals,
  row: {
    model?: string | null;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
  }
): void {
  const prompt = Number(row.prompt_tokens) || 0;
  const completion = Number(row.completion_tokens) || 0;
  let total = Number(row.total_tokens) || 0;
  if (total === 0 && (prompt > 0 || completion > 0)) total = prompt + completion;
  into.calls += 1;
  into.promptTokens += prompt;
  into.completionTokens += completion;
  into.totalTokens += total;
  into.estimatedUsd = roundUsd(
    into.estimatedUsd +
      estimateUsdForModel(row.model ?? null, {
        prompt_tokens: prompt,
        completion_tokens: completion,
      })
  );
}

/**
 * Best-effort persist of one successful LLM call (or aggregated loop).
 * Never throws; metering must not break the user-facing route.
 * Store the real model id (gemini-… or kimi-…) so the dashboard can split spend.
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
