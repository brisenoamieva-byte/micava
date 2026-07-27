import { ImageResponse } from "next/og";

export const alt = "Cavatale — Tu cava, con historias";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          padding: "64px 72px",
          fontFamily:
            "ui-serif, Georgia, 'Times New Roman', Times, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#6e1f2c",
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          Cavatale
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              color: "#141210",
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 980,
            }}
          >
            Tu cava, con historias
          </div>
          <div
            style={{
              display: "flex",
              color: "#3c3731",
              fontSize: 32,
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Inventario, mapa e historias que abren conversación al descorchar.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            color: "#6e1f2c",
            fontSize: 28,
            fontWeight: 500,
          }}
        >
          cavatale.com · gratis
        </div>
      </div>
    ),
    { ...size }
  );
}
