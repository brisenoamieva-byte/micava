import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { PublicCellarView } from "@/components/PublicCellarView";
import type { NetworkProfile, PublicWine } from "@/lib/network";
import {
  isValidPublicHandle,
  normalizePublicHandle,
} from "@/lib/public-handle";
import { createClient } from "@/lib/supabase/server";

const PROFILE_COLS =
  "id, display_name, public_handle, country, city, bio, network_visible, cava_public, network_updated_at";

const PUBLIC_WINE_COLS =
  "id, user_id, country, region, type, winery, name, aging, grape, vintage, vivino, cavatale_rating";

type PageProps = {
  params: Promise<{ handle: string }>;
};

function supabaseEnvReady(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = normalizePublicHandle(raw);
  if (!isValidPublicHandle(handle)) {
    return { title: "Cava no encontrada — Cavatale" };
  }

  const url = `https://cavatale.com/u/${handle}`;
  let displayName = `@${handle}`;
  let bottleCount: number | null = null;

  if (supabaseEnvReady()) {
    try {
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("public_handle", handle)
        .eq("cava_public", true)
        .maybeSingle();

      if (profile) {
        displayName =
          (profile.display_name as string | null)?.trim() || `@${handle}`;
        const { count } = await supabase
          .from("public_wines")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id as string);
        bottleCount = count ?? 0;
      }
    } catch {
      /* metadata still falls back to handle-only copy */
    }
  }

  const title = `${displayName} (@${handle}) — Cava en Cavatale`;
  const description =
    bottleCount == null
      ? `Explora la cava pública de ${displayName} en Cavatale. Crea la tuya gratis.`
      : bottleCount === 1
        ? `1 botella en la cava pública de ${displayName}. Explórala y crea la tuya gratis en Cavatale.`
        : `${bottleCount} botellas en la cava pública de ${displayName}. Explórala y crea la tuya gratis en Cavatale.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      locale: "es_MX",
      siteName: "Cavatale",
      url,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicHandlePage({ params }: PageProps) {
  const { handle: raw } = await params;
  const handle = normalizePublicHandle(raw);

  if (!isValidPublicHandle(handle)) {
    notFound();
  }

  if (!supabaseEnvReady()) {
    return (
      <main className="grain relative min-h-screen min-h-[100dvh]">
        <div className="relative z-10 mx-auto max-w-2xl px-5 py-10">
          <BrandMark size="sm" />
          <p className="mt-8 text-sm text-ink-soft">
            Esta cava no está disponible en este momento.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("public_handle", handle)
    .eq("cava_public", true)
    .maybeSingle();

  if (profileError || !profileRow) {
    notFound();
  }

  const profile = profileRow as NetworkProfile;
  const isOwnCava = Boolean(user && user.id === profile.id);
  const showSignupCta = !user;

  const { data: wineRows } = await supabase
    .from("public_wines")
    .select(PUBLIC_WINE_COLS)
    .eq("user_id", profile.id)
    .order("name", { ascending: true })
    .limit(500);

  const wines = (wineRows as PublicWine[]) ?? [];

  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto max-w-2xl px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="mb-6 flex items-center justify-between gap-3">
          <BrandMark size="sm" />
          {user ? (
            <Link
              href="/cava"
              className="btn btn-ghost min-h-[40px] px-3 text-sm"
            >
              {isOwnCava ? "Editar mi cava" : "Mi cava"}
            </Link>
          ) : (
            <Link
              href="/registro"
              className="btn btn-primary min-h-[40px] px-3 text-sm"
            >
              Crear mi cava
            </Link>
          )}
        </header>
        <PublicCellarView
          profile={profile}
          wines={wines}
          backHref="/"
          backLabel="← Cavatale"
          showSignupCta={showSignupCta}
        />
      </div>
    </main>
  );
}
