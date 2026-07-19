"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function RecoverPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-ink-soft">
        Falta configurar Supabase.
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/nueva-contrasena")}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (err) {
        setError(err.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar el correo"
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink">
          Si existe una cuenta con <strong>{email.trim()}</strong>, te
          enviamos un enlace para elegir una contraseña nueva. Revisa también
          spam.
        </p>
        <p className="text-sm text-ink-soft">
          El enlace te trae de vuelta a Mi Cava para definirla.
        </p>
        <Link
          href="/login"
          className="btn btn-ghost inline-flex min-h-[44px] items-center px-4 text-sm"
        >
          Volver a entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          Email de tu cuenta
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 outline-none focus:border-[rgba(122,36,48,0.45)]"
        />
      </label>
      {error ? <p className="text-sm text-[var(--wine-deep)]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary min-h-[48px] w-full"
      >
        {loading ? "Enviando…" : "Enviar enlace"}
      </button>
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="text-ink underline-offset-2 hover:underline">
          Volver a entrar
        </Link>
      </p>
    </form>
  );
}
