import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Best-effort in-memory rate limit. On Vercel each isolate has its own Map,
 * so this is a soft guard — not a hard global quota.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function clientKey(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `ip:${ip}`;
}

function hitRateLimit(key: string): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  existing.count += 1;
  if (existing.count > MAX_REQUESTS) return true;
  return false;
}

export type ApiGuardOk = { ok: true; userId: string | null };
export type ApiGuardFail = { ok: false; response: NextResponse };
export type ApiGuardResult = ApiGuardOk | ApiGuardFail;

/**
 * Auth (when Supabase env is set) + soft rate limit for Kimi-backed routes.
 * Without Supabase config, allows the request (local demo) but still rate-limits by IP.
 */
export async function guardKimiApi(request: Request): Promise<ApiGuardResult> {
  let userId: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Inicia sesión para usar esta función." },
            { status: 401 }
          ),
        };
      }
      userId = user.id;
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "No se pudo verificar la sesión." },
          { status: 503 }
        ),
      };
    }
  }

  const key = clientKey(request, userId);
  if (hitRateLimit(key)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Demasiadas consultas seguidas. Espera unos minutos e inténtalo de nuevo.",
        },
        { status: 429 }
      ),
    };
  }

  return { ok: true, userId };
}
