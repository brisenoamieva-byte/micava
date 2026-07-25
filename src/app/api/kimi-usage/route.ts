import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  estimateKimiUsd,
  KIMI_PRICE_IN_PER_M,
  KIMI_PRICE_OUT_PER_M,
} from "@/lib/kimi-usage";

export const runtime = "nodejs";

function monthStartUtc(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
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
    .select("prompt_tokens, completion_tokens, total_tokens, route, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (error) {
    return NextResponse.json(
      {
        error:
          /kimi_usage_events|schema|relation/i.test(error.message)
            ? "Falta la migración 008_kimi_usage.sql en Supabase."
            : error.message,
      },
      { status: 503 }
    );
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let calls = 0;
  const byRoute: Record<string, number> = {};

  for (const row of data ?? []) {
    calls += 1;
    promptTokens += Number(row.prompt_tokens) || 0;
    completionTokens += Number(row.completion_tokens) || 0;
    totalTokens += Number(row.total_tokens) || 0;
    const route = typeof row.route === "string" ? row.route : "other";
    byRoute[route] = (byRoute[route] ?? 0) + 1;
  }

  const estimatedUsd = estimateKimiUsd({
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  });

  return NextResponse.json({
    period: "month",
    since,
    calls,
    promptTokens,
    completionTokens,
    totalTokens,
    byRoute,
    estimatedUsd: Math.round(estimatedUsd * 1_000_000) / 1_000_000,
    rates: {
      inputPerMillionUsd: KIMI_PRICE_IN_PER_M,
      outputPerMillionUsd: KIMI_PRICE_OUT_PER_M,
      model: "kimi-k2.6",
    },
  });
}
