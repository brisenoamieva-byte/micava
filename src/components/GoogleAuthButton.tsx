"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  next?: string;
  label?: string;
};

export function GoogleAuthButton({
  next = "/cava",
  label = "Continuar con Google",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (err) {
        setError(friendlyOAuthError(err.message));
        setLoading(false);
      }
      // Browser redirects to Google — leave loading on success
    } catch (err) {
      setError(
        err instanceof Error
          ? friendlyOAuthError(err.message)
          : "No se pudo abrir Google"
      );
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={loading}
        className="btn btn-primary flex min-h-[48px] w-full items-center justify-center gap-2.5 text-sm"
      >
        <GoogleMark />
        {loading ? "Abriendo Google…" : label}
      </button>
      {error ? <p className="text-sm text-[var(--wine-deep)]">{error}</p> : null}
    </div>
  );
}

function friendlyOAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("provider is not enabled") ||
    lower.includes("unsupported provider")
  ) {
    return "Google aún no está activado en Supabase. Usa email/contraseña, o en el dashboard: Authentication → Providers → Google.";
  }
  return message;
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.5 6.6l.1.1 6.2 5.2C36.5 41.1 44 36 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-[var(--line)]" />
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        o
      </span>
      <div className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}
