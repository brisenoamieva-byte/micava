import { NextResponse, type NextRequest } from "next/server";
import { createAuthRouteClient } from "@/lib/supabase/auth-route";
import {
  PENDING_PASSWORD_COOKIE,
  pendingPasswordCookieOptions,
} from "@/lib/pending-password";

/**
 * Password-recovery entry: exchange the email link code, mark "must set password",
 * then land on /nueva-contrasena (never /cava).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const secure = origin.startsWith("https");

  const successUrl = `${origin}/nueva-contrasena`;
  const failUrl = `${origin}/recuperar?error=enlace`;

  function markPending(response: NextResponse) {
    response.cookies.set(
      PENDING_PASSWORD_COOKIE,
      "1",
      pendingPasswordCookieOptions(secure)
    );
    return response;
  }

  if (code) {
    const response = markPending(NextResponse.redirect(successUrl));
    const supabase = createAuthRouteClient(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return response;
    }
  }

  if (tokenHash && type === "recovery") {
    const response = markPending(NextResponse.redirect(successUrl));
    const supabase = createAuthRouteClient(request, response);
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (!error) {
      return response;
    }
  }

  {
    const response = markPending(NextResponse.redirect(successUrl));
    const supabase = createAuthRouteClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return response;
    }
  }

  return NextResponse.redirect(failUrl);
}
