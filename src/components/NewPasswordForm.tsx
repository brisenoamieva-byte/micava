"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { useT } from "@/lib/i18n";
import { PENDING_PASSWORD_COOKIE } from "@/lib/pending-password";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

function clearPendingPasswordCookie() {
  document.cookie = `${PENDING_PASSWORD_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
}

function setPendingPasswordCookie() {
  document.cookie = `${PENDING_PASSWORD_COOKIE}=1; Max-Age=3600; path=/; SameSite=Lax`;
}

export function NewPasswordForm() {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
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
    let cancelled = false;

    async function ensureSession() {
      const code = search.get("code");
      if (code) {
        window.location.replace(
          `/auth/reset?code=${encodeURIComponent(code)}${
            search.get("type")
              ? `&type=${encodeURIComponent(search.get("type")!)}`
              : ""
          }`
        );
        return;
      }

      const tokenHash = search.get("token_hash");
      const type = search.get("type");
      if (tokenHash && type === "recovery") {
        window.location.replace(
          `/auth/reset?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
        );
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        const ok = Boolean(data.session);
        setHasSession(ok);
        if (ok) setPendingPasswordCookie();
        setReady(true);
      }
    }

    void ensureSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(Boolean(session));
        if (session) setPendingPasswordCookie();
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [search]);

  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-ink-soft">{t("auth.missingSupabase")}</p>;
  }

  if (!ready) {
    return <p className="text-sm text-ink-soft">{t("common.loading")}</p>;
  }

  if (!hasSession) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          {t("auth.linkExpired")}
        </p>
        {error ? (
          <p className="text-sm text-[var(--wine-deep)]">{error}</p>
        ) : null}
        <Link href="/recuperar" className="btn btn-primary min-h-[48px] w-full">
          {t("auth.requestLink")}
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t("auth.passwordMin"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
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
      clearPendingPasswordCookie();
      router.replace("/cava");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.passwordFailed")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm leading-relaxed text-ink">{t("auth.newPasswordLead")}</p>
      <PasswordInput
        label={t("auth.newPassword")}
        name="new-password"
        required
        autoComplete="new-password"
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordInput
        label={t("auth.confirmPassword")}
        name="confirm-password"
        required
        autoComplete="new-password"
        minLength={6}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error ? <p className="text-sm text-[var(--wine-deep)]">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary min-h-[48px] w-full"
      >
        {loading ? t("auth.saving") : t("auth.saveAndEnter")}
      </button>
    </form>
  );
}
