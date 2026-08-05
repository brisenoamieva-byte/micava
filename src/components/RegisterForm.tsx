"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthDivider, GoogleAuthButton } from "@/components/GoogleAuthButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function RegisterForm() {
  const t = useT();
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
      <p className="text-sm text-ink-soft">{t("auth.missingSupabase")}</p>
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
      // Notify only with a session (route requires auth). Pending email
      // confirm is covered by /auth/callback after the user verifies.
      if (data.session) {
        void fetch("/api/notify-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: displayName.trim() || null,
            provider: "email",
          }),
        }).catch(() => {});
        router.replace("/cava");
        router.refresh();
        return;
      }
      setInfo(t("auth.confirmEmail"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LanguageSwitcher compact />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="micro-label mb-1 block text-ink-soft">
            {t("auth.displayName")}
          </span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("auth.displayNamePlaceholder")}
            className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 outline-none focus:border-[rgba(122,36,48,0.45)]"
          />
        </label>
        <label className="block">
          <span className="micro-label mb-1 block text-ink-soft">
            {t("auth.email")}
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
        <PasswordInput
          label={t("auth.password")}
          required
          autoComplete="new-password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-1"
            checked={bottlePledge}
            onChange={(e) => setBottlePledge(e.target.checked)}
          />
          <span>{t("auth.bottlePledgeAlt")}</span>
        </label>

        {error ? <p className="text-sm text-[var(--wine-deep)]">{error}</p> : null}
        {info ? <p className="text-sm text-ink">{info}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary min-h-[48px] w-full"
        >
          {loading ? t("auth.creating") : t("auth.createMyCellar")}
        </button>
      </form>
      <AuthDivider />
      <GoogleAuthButton next="/cava" />
      <p className="text-center text-sm text-ink-soft">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="text-ink underline-offset-2 hover:underline">
          {t("auth.enter")}
        </Link>
      </p>
    </div>
  );
}
