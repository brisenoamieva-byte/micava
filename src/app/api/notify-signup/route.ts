import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  guardNotifyRateLimit,
  timingSafeEqualString,
} from "@/lib/api-guard";
import {
  isRecentlyCreatedUser,
  notifyNewSignup,
} from "@/lib/notify-signup";

export const runtime = "nodejs";

/**
 * Fire after email signup (with session) or via trusted server secret.
 * Unauthenticated public spam of founder webhooks is rejected.
 * Body (optional if session exists): { email?, displayName?, provider? }
 *
 * Auth: session cookie OR header `x-signup-notify-secret: $SIGNUP_NOTIFY_SECRET`
 * (OAuth / email-confirm already notify from /auth/callback.)
 */
export async function POST(request: NextRequest) {
  let body: {
    email?: string;
    displayName?: string | null;
    provider?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const notifySecret = process.env.SIGNUP_NOTIFY_SECRET?.trim();

  const providedSecret =
    request.headers.get("x-signup-notify-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  const secretOk = Boolean(
    notifySecret &&
      providedSecret &&
      timingSafeEqualString(providedSecret, notifySecret)
  );

  let sessionEmail: string | null = null;
  let displayName: string | null = body.displayName?.trim() || null;
  let userId: string | undefined;
  let provider = body.provider?.trim() || "email";
  let isNew = false;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* read-only */
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      sessionEmail = user.email ?? null;
      userId = user.id;
      isNew = isRecentlyCreatedUser(user.created_at);
      const meta = user.user_metadata ?? {};
      displayName =
        displayName ||
        (meta.display_name as string | undefined) ||
        (meta.full_name as string | undefined) ||
        (meta.name as string | undefined) ||
        null;
      const identities = user.app_metadata?.provider;
      if (typeof identities === "string") provider = identities;
      else if (user.app_metadata?.providers?.[0]) {
        provider = String(user.app_metadata.providers[0]);
      }
    }
  }

  if (!sessionEmail && !secretOk) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401 }
    );
  }

  const rate = guardNotifyRateLimit(request, userId ?? null);
  if (!rate.ok) return rate.response;

  // Session path: never trust a mismatched body email; skip non-new accounts.
  if (sessionEmail) {
    if (!isNew && !secretOk) {
      return NextResponse.json({ ok: true, skipped: "existing user" });
    }
    const result = await notifyNewSignup({
      email: sessionEmail,
      displayName,
      provider,
      userId,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  // Secret path (server-to-server / ops): body email required.
  const email = (body.email?.trim() || "").trim();
  if (!email) {
    return NextResponse.json({ error: "Falta email." }, { status: 400 });
  }

  const result = await notifyNewSignup({
    email,
    displayName,
    provider,
    userId,
  });

  return NextResponse.json({ ok: true, ...result });
}
