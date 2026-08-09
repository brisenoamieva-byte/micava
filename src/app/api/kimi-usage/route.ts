import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  accumulateProviderUsage,
  emptyProviderTotals,
  GEMINI_FLASH_PRICE_IN_PER_M,
  GEMINI_FLASH_PRICE_OUT_PER_M,
  KIMI_PRICE_IN_PER_M,
  KIMI_PRICE_OUT_PER_M,
  providerFromModel,
  type ProviderUsageTotals,
} from "@/lib/kimi-usage";

export const runtime = "nodejs";

function monthStartUtc(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export async function GET() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Supabase no configurado." },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Inicia sesión para ver tu uso." },
      { status: 401 }
    );
  }

  const since = monthStartUtc();
  const { data, error } = await supabase
    .from("kimi_usage_events")
    .select(
      "prompt_tokens, completion_tokens, total_tokens, route, model, created_at"
    )
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (error) {
    return NextResponse.json(
      {
        error: /kimi_usage_events|schema|relation/i.test(error.message)
          ? "Falta la migración 008_kimi_usage.sql en Supabase."
          : error.message,
      },
      { status: 503 }
    );
  }

  const kimi = emptyProviderTotals("kimi");
  const gemini = emptyProviderTotals("gemini");
  const other = emptyProviderTotals("other");
  const byRoute: Record<string, number> = {};

  for (const row of data ?? []) {
    const provider = providerFromModel(
      typeof row.model === "string" ? row.model : ""
    );
    const bucket =
      provider === "gemini" ? gemini : provider === "kimi" ? kimi : other;
    accumulateProviderUsage(bucket, row);
    const route = typeof row.route === "string" ? row.route : "other";
    byRoute[route] = (byRoute[route] ?? 0) + 1;
  }

  const total: ProviderUsageTotals = {
    provider: "other",
    calls: kimi.calls + gemini.calls + other.calls,
    promptTokens: kimi.promptTokens + gemini.promptTokens + other.promptTokens,
    completionTokens:
      kimi.completionTokens + gemini.completionTokens + other.completionTokens,
    totalTokens: kimi.totalTokens + gemini.totalTokens + other.totalTokens,
    estimatedUsd: roundUsd(
      kimi.estimatedUsd + gemini.estimatedUsd + other.estimatedUsd
    ),
  };

  return NextResponse.json({
    period: "month",
    since,
    // Legacy flat fields (= total) so older clients keep working.
    calls: total.calls,
    promptTokens: total.promptTokens,
    completionTokens: total.completionTokens,
    totalTokens: total.totalTokens,
    estimatedUsd: total.estimatedUsd,
    byRoute,
    byProvider: {
      kimi: {
        calls: kimi.calls,
        promptTokens: kimi.promptTokens,
        completionTokens: kimi.completionTokens,
        totalTokens: kimi.totalTokens,
        estimatedUsd: kimi.estimatedUsd,
      },
      gemini: {
        calls: gemini.calls,
        promptTokens: gemini.promptTokens,
        completionTokens: gemini.completionTokens,
        totalTokens: gemini.totalTokens,
        estimatedUsd: gemini.estimatedUsd,
      },
      ...(other.calls > 0
        ? {
            other: {
              calls: other.calls,
              promptTokens: other.promptTokens,
              completionTokens: other.completionTokens,
              totalTokens: other.totalTokens,
              estimatedUsd: other.estimatedUsd,
            },
          }
        : {}),
    },
    total: {
      calls: total.calls,
      promptTokens: total.promptTokens,
      completionTokens: total.completionTokens,
      totalTokens: total.totalTokens,
      estimatedUsd: total.estimatedUsd,
    },
    rates: {
      kimi: {
        inputPerMillionUsd: KIMI_PRICE_IN_PER_M,
        outputPerMillionUsd: KIMI_PRICE_OUT_PER_M,
        model: "kimi-k2.6",
      },
      gemini: {
        inputPerMillionUsd: GEMINI_FLASH_PRICE_IN_PER_M,
        outputPerMillionUsd: GEMINI_FLASH_PRICE_OUT_PER_M,
        model: "gemini-3.5-flash",
      },
    },
  });
}
