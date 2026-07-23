import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // token_hash flow (some templates)
  const tokenHash = searchParams.get("token_hash");
  if (tokenHash && (type === "recovery" || type === "email")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type === "recovery" ? "recovery" : "email",
      token_hash: tokenHash,
    });
    if (!error) {
      const dest = type === "recovery" ? "/nueva-contrasena" : next;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
