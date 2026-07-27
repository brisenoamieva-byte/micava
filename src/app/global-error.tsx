"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#e5e2da",
          color: "#1c1917",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.85rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            Cavatale
          </p>
          <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.5rem", fontWeight: 600 }}>
            Algo salió mal
          </h1>
          <p style={{ margin: "0 0 1.25rem", lineHeight: 1.5, opacity: 0.85 }}>
            Ya quedó registrado. Puedes intentar de nuevo.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              appearance: "none",
              border: "none",
              borderRadius: "999px",
              background: "#7a2430",
              color: "#faf9f5",
              padding: "0.65rem 1.25rem",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
