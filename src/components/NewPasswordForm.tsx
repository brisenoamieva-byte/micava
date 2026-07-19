"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function NewPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setReady(true);
    });
  }, []);

  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-ink-soft">Falta configurar Supabase.</p>;
  }

  if (!ready) {
    return <p className="text-sm text-ink-soft">Cargando…</p>;
  }

  if (!hasSession) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          Este enlace expiró o aún no pediste recuperación. Solicita uno nuevo
          desde tu email.
        </p>
        <Link href="/recuperar" className="btn btn-primary min-h-[48px] w-full">
          Pedir enlace
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message);
        return;
      }
      router.replace("/cava");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la contraseña"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          Nueva contraseña
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 outline-none focus:border-[rgba(122,36,48,0.45)]"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          Confirmar
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 outline-none focus:border-[rgba(122,36,48,0.45)]"
        />
      </label>
      {error ? <p className="text-sm text-[var(--wine-deep)]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary min-h-[48px] w-full"
      >
        {loading ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
