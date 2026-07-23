import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Password-recovery entry: always lands on /nueva-contrasena after exchanging the code.
 * Using a dedicated path avoids losing ?next= when Supabase strips query params.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/nueva-contrasena`);
    }
    // Code may already have been exchanged client-side; if we have a session, continue.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(`${origin}/nueva-contrasena`);
    }
  }

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}/nueva-contrasena`);
    }
  }

  // No code but already in a recovery/signed-in session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${origin}/nueva-contrasena`);
  }

  return NextResponse.redirect(`${origin}/recuperar?error=enlace`);
}
