import { NextResponse, type NextRequest } from "next/server";
import { createAuthRouteClient } from "@/lib/supabase/auth-route";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const nextRaw = searchParams.get("next") ?? "/cava";
  const next =
    type === "recovery"
      ? "/nueva-contrasena"
      : nextRaw.startsWith("/") && !nextRaw.startsWith("//")
        ? nextRaw
        : "/cava";

  const dest = `${origin}${next}`;
  const fail = `${origin}/login?error=auth`;

  if (code) {
    const response = NextResponse.redirect(dest);
    const supabase = createAuthRouteClient(request, response);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  const tokenHash = searchParams.get("token_hash");
  if (tokenHash && (type === "recovery" || type === "email")) {
    const response = NextResponse.redirect(
      type === "recovery" ? `${origin}/nueva-contrasena` : dest
    );
    const supabase = createAuthRouteClient(request, response);
    const { error } = await supabase.auth.verifyOtp({
      type: type === "recovery" ? "recovery" : "email",
      token_hash: tokenHash,
    });
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(fail);
}
