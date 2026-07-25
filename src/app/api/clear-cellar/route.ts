import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Wipe all wines (+ history) for the signed-in user.
 * Returns how many rows were removed so the client can verify.
 */
export async function POST() {
  try {
    const supabase = await createClient();
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
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "No se pudo vaciar la cava.",
      },
      { status: 500 }
    );
  }
}
