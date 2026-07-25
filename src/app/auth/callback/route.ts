import { NextResponse, type NextRequest } from "next/server";
import { createAuthRouteClient } from "@/lib/supabase/auth-route";
import {
  PENDING_PASSWORD_COOKIE,
  pendingPasswordCookieOptions,
} from "@/lib/pending-password";
import {
  isRecentlyCreatedUser,
  notifyNewSignup,
} from "@/lib/notify-signup";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const nextRaw = searchParams.get("next") ?? "/cava";
  const isRecovery = type === "recovery";
  const next = isRecovery
    ? "/nueva-contrasena"
    : nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/cava";

  const dest = `${origin}${next}`;
  const fail = `${origin}/login?error=auth`;
  const secure = origin.startsWith("https");

  function withPending(response: NextResponse) {
    if (isRecovery) {
      response.cookies.set(
        PENDING_PASSWORD_COOKIE,
        "1",
        pendingPasswordCookieOptions(secure)
      );
    }
    return response;
  }

  async function maybeNotifyNewUser(
    supabase: ReturnType<typeof createAuthRouteClient>
  ) {
    if (isRecovery) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email || !isRecentlyCreatedUser(user.created_at)) return;
      const meta = user.user_metadata ?? {};
      await notifyNewSignup({
        email: user.email,
        displayName:
          (meta.display_name as string | undefined) ||
          (meta.full_name as string | undefined) ||
          (meta.name as string | undefined) ||
          null,
        provider:
          typeof user.app_metadata?.provider === "string"
            ? user.app_metadata.provider
            : "oauth",
        userId: user.id,
      });
    } catch {
      /* never block auth redirect */
    }
  }

  if (code) {
    const response = withPending(NextResponse.redirect(dest));
    const supabase = createAuthRouteClient(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await maybeNotifyNewUser(supabase);
      return response;
    }
  }

  const tokenHash = searchParams.get("token_hash");
  if (tokenHash && (type === "recovery" || type === "email")) {
    const response = withPending(
      NextResponse.redirect(
        type === "recovery" ? `${origin}/nueva-contrasena` : dest
      )
    );
    const supabase = createAuthRouteClient(request, response);
    const { error } = await supabase.auth.verifyOtp({
      type: type === "recovery" ? "recovery" : "email",
      token_hash: tokenHash,
    });
    if (!error) {
      await maybeNotifyNewUser(supabase);
      return response;
    }
  }

  return NextResponse.redirect(fail);
}
