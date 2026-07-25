import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Best-effort in-memory rate limit. On Vercel each isolate has its own Map,
 * so this is a soft guard — not a hard global quota.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
/** Stricter cap for founder-notify (abuse = spam to Discord/email). */
const NOTIFY_WINDOW_MS = 10 * 60 * 1000;
const NOTIFY_MAX_REQUESTS = 8;

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

function hitRateLimit(
  key: string,
  maxRequests = MAX_REQUESTS,
  windowMs = WINDOW_MS
): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  existing.count += 1;
  if (existing.count > maxRequests) return true;
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

/**
 * Soft rate limit for /api/notify-signup (IP or user).
 * Call after auth/secret checks so attackers hit 401 before burning quota less often.
 */
export function guardNotifyRateLimit(request: Request, userId?: string | null): ApiGuardResult {
  const key = `notify:${clientKey(request, userId)}`;
  if (hitRateLimit(key, NOTIFY_MAX_REQUESTS, NOTIFY_WINDOW_MS)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Demasiados avisos. Espera unos minutos." },
        { status: 429 }
      ),
    };
  }
  return { ok: true, userId: userId ?? null };
}

/** Constant-time-ish compare for optional SIGNUP_NOTIFY_SECRET. */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
