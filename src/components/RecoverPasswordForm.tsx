"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { PASSWORD_RECOVERY_FLAG } from "@/components/PasswordRecoveryRedirect";

export function RecoverPasswordForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-ink-soft">{t("auth.missingSupabase")}</p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      // Flag so if Supabase sends the user to Site URL (/?code=...) we still
      // route them into the new-password flow.
      sessionStorage.setItem(PASSWORD_RECOVERY_FLAG, "1");
      // Land on /auth/reset so the server exchanges the code and redirects
      // to /nueva-contrasena with session cookies on the response.
      const redirectTo = `${window.location.origin}/auth/reset`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (err) {
        sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
        setError(err.message);
        return;
      }
      setSent(true);
    } catch (err) {
      sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
      setError(err instanceof Error ? err.message : t("auth.recoverFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink">
          {t("auth.recoverSent", { email: email.trim() })}
        </p>
        <p className="text-sm text-ink-soft">{t("auth.recoverSentHint")}</p>
        <Link
          href="/login"
          className="btn btn-ghost inline-flex min-h-[44px] items-center px-4 text-sm"
        >
          {t("auth.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LanguageSwitcher compact />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {t("auth.accountEmail")}
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
          {loading ? t("auth.sending") : t("auth.sendLink")}
        </button>
        <p className="text-center text-sm text-ink-soft">
          <Link href="/login" className="text-ink underline-offset-2 hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </form>
    </div>
  );
}
