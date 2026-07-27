import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import {
  isValidPublicHandle,
  normalizePublicHandle,
} from "@/lib/public-handle";

export const alt = "Cava pública en Cavatale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ handle: string }>;
};

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function Image({ params }: Props) {
  const { handle: raw } = await params;
  const handle = normalizePublicHandle(raw);

  let displayName = "Coleccionista";
  let bottleCount: number | null = null;
  let place = "";

  if (isValidPublicHandle(handle)) {
    const supabase = publicSupabase();
    if (supabase) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, country, city")
        .eq("public_handle", handle)
        .eq("cava_public", true)
        .maybeSingle();

      if (profile) {
        displayName =
          (profile.display_name as string | null)?.trim() || "Coleccionista";
        const city = (profile.city as string | null)?.trim();
        const country = (profile.country as string | null)?.trim();
        place = [city, country].filter(Boolean).join(", ");

        const { count } = await supabase
          .from("public_wines")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id as string);
        bottleCount = count ?? 0;
      }
    }
  }

  const subtitle =
    bottleCount == null
      ? "Cava pública"
      : bottleCount === 1
        ? "1 botella · cava pública"
        : `${bottleCount} botellas · cava pública`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(145deg, #f6f2ea 0%, #e8e2d6 48%, #d9cfc0 100%)",
          padding: "56px 64px",
          fontFamily:
            "ui-serif, Georgia, 'Times New Roman', Times, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#6e1f2c",
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Cavatale
          </div>
          <div
            style={{
              display: "flex",
              color: "#3c3731",
              fontSize: 24,
              opacity: 0.85,
            }}
          >
            cavatale.com
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              color: "#141210",
              fontSize: 68,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 980,
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              display: "flex",
              color: "#6e1f2c",
              fontSize: 38,
              fontWeight: 500,
            }}
          >
            @{handle || "cava"}
          </div>
          {place ? (
            <div
              style={{
                display: "flex",
                color: "#3c3731",
                fontSize: 26,
                marginTop: 4,
              }}
            >
              {place}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(110, 31, 44, 0.22)",
            paddingTop: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              color: "#3c3731",
              fontSize: 28,
            }}
          >
            {subtitle}
          </div>
          <div
            style={{
              display: "flex",
              color: "#6e1f2c",
              fontSize: 24,
              fontWeight: 500,
            }}
          >
            Crea la tuya gratis
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
