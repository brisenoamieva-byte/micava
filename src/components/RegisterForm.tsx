"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bottlePledge, setBottlePledge] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-ink-soft">
        Falta configurar Supabase. Añade las variables de entorno del proyecto.
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim() || undefined,
            bottle_pledge: bottlePledge,
          },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback?next=/cava`
              : undefined,
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      if (data.session) {
        router.replace("/cava");
        router.refresh();
        return;
      }
      setInfo(
        "Revisa tu correo para confirmar la cuenta. Después podrás entrar."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Cómo te llamamos
          </span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre"
            className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 outline-none focus:border-[rgba(122,36,48,0.45)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Email
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
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Contraseña
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

        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-1"
            checked={bottlePledge}
            onChange={(e) => setBottlePledge(e.target.checked)}
          />
          <span>
            Si un día te gusta de verdad, me traes una botella.
            <span className="block text-xs text-ink-soft">
              Gratis siempre. Sin cobros — solo un trato entre amigos del vino.
            </span>
          </span>
        </label>

        {error ? <p className="text-sm text-[var(--wine-deep)]">{error}</p> : null}
        {info ? <p className="text-sm text-ink">{info}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary min-h-[48px] w-full"
        >
          {loading ? "Creando…" : "Crear mi cava"}
        </button>
        <p className="text-center text-sm text-ink-soft">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-ink underline-offset-2 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
