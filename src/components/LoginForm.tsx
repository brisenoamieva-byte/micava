"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthDivider, GoogleAuthButton } from "@/components/GoogleAuthButton";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search.get("next") || "/cava";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/cava";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-ink-soft">
        Falta configurar Supabase. Añade{" "}
        <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
        <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="micro-label mb-1 block text-ink-soft">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 outline-none focus:border-[rgba(122,36,48,0.45)]"
          />
        </label>
        <PasswordInput
          label={
            <>
              <span>Contraseña</span>
              <Link
                href="/recuperar"
                className="normal-case tracking-normal text-ink underline-offset-2 hover:underline"
              >
                ¿Olvidaste?
              </Link>
            </>
          }
          required
          autoComplete="current-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-[var(--wine-deep)]">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary min-h-[48px] w-full"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <AuthDivider />
      <GoogleAuthButton next={next} label="Continuar con Google" />
      <p className="text-center text-sm text-ink-soft">
        ¿Nuevo?{" "}
        <Link href="/registro" className="text-ink underline-offset-2 hover:underline">
          Crear mi cava
        </Link>
      </p>
    </div>
  );
}
