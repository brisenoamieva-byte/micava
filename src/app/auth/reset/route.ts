import { NextResponse, type NextRequest } from "next/server";
import { createAuthRouteClient } from "@/lib/supabase/auth-route";

/**
 * Password-recovery entry: exchange the email link code, then land on
 * /nueva-contrasena with session cookies attached to the redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const successUrl = `${origin}/nueva-contrasena`;
  const failUrl = `${origin}/recuperar?error=enlace`;

  if (code) {
    const response = NextResponse.redirect(successUrl);
    const supabase = createAuthRouteClient(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    // Code may already be exchanged; if session cookies exist, continue.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return response;
    }
  }

  if (tokenHash && type === "recovery") {
    const response = NextResponse.redirect(successUrl);
    const supabase = createAuthRouteClient(request, response);
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (!error) {
      return response;
    }
  }

  // Already signed in (e.g. client exchanged first) → still show new password
  {
    const response = NextResponse.redirect(successUrl);
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
