import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isRecentlyCreatedUser,
  notifyNewSignup,
} from "@/lib/notify-signup";

/**
 * Fire after email signup or OAuth callback for brand-new users.
 * Body (optional if session exists): { email?, displayName?, provider? }
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

  const email = (body.email?.trim() || sessionEmail || "").trim();
  if (!email) {
    return NextResponse.json({ error: "Falta email." }, { status: 400 });
  }

  // Prefer notifying for truly new sessions; still allow pending-confirm
  // signups (no session yet) when the client sends the email right after signUp.
  if (sessionEmail && !isNew) {
    return NextResponse.json({ ok: true, skipped: "existing user" });
  }

  const result = await notifyNewSignup({
    email,
    displayName,
    provider,
    userId,
  });

  return NextResponse.json({ ok: true, ...result });
}
