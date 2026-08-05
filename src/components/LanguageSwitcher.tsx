"use client";

import { useLocale } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";

export function LanguageSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useLocale();

  function onChange(next: Locale) {
    if (next === locale) return;
    setLocale(next);
  }

  return (
    <div
      className={`inline-flex items-center rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] p-0.5 ${className}`}
      role="group"
      aria-label={t("common.language")}
    >
      <button
        type="button"
        onClick={() => onChange("es")}
        className={[
          "min-h-[32px] rounded-[8px] px-2.5 text-xs transition",
          locale === "es"
            ? "bg-[rgba(110,31,44,0.12)] font-medium text-ink"
            : "text-ink-soft hover:text-ink",
        ].join(" ")}
        aria-pressed={locale === "es"}
      >
        {compact ? "ES" : t("common.spanish")}
      </button>
      <button
        type="button"
        onClick={() => onChange("en")}
        className={[
          "min-h-[32px] rounded-[8px] px-2.5 text-xs transition",
          locale === "en"
            ? "bg-[rgba(110,31,44,0.12)] font-medium text-ink"
            : "text-ink-soft hover:text-ink",
        ].join(" ")}
        aria-pressed={locale === "en"}
      >
        {compact ? "EN" : t("common.english")}
      </button>
    </div>
  );
}
