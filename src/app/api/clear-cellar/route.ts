import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Wipe all wines (+ history) for the signed-in user.
 * Uses request cookies explicitly so the session is reliable in Route Handlers.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase no está configurado." },
      { status: 503 }
    );
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        /* no-op: wipe does not refresh session cookies */
      },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { error: "Inicia sesión para vaciar tu cava." },
      { status: 401 }
    );
  }

  let deleted = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data: batch, error: selErr } = await supabase
      .from("wines")
      .select("id")
      .eq("user_id", user.id)
      .limit(200);

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 });
    }
    if (!batch?.length) break;

    const ids = batch.map((r) => r.id as string);
    const { data: removed, error: delErr } = await supabase
      .from("wines")
      .delete()
      .eq("user_id", user.id)
      .in("id", ids)
      .select("id");

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    if (!removed?.length) {
      return NextResponse.json(
        {
          error:
            "No se pudieron borrar las botellas (permisos). Cierra sesión, vuelve a entrar e inténtalo.",
          remaining: ids.length,
        },
        { status: 403 }
      );
    }
    deleted += removed.length;
  }

  await supabase.from("cellar_history").delete().eq("user_id", user.id);

  const { count } = await supabase
    .from("wines")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({
    ok: true,
    deleted,
    remaining: count ?? 0,
  });
}
