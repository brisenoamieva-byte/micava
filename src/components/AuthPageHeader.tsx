"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

type AuthPageHeaderProps = {
  titleKey: string;
  subtitleKey?: string;
  subtitleClassName?: string;
};

export function AuthPageHeader({
  titleKey,
  subtitleKey,
  subtitleClassName = "mt-2 text-sm text-ink-soft",
}: AuthPageHeaderProps) {
  const t = useT();
  return (
    <>
      <h1 className="display text-4xl text-ink">{t(titleKey)}</h1>
      {subtitleKey ? (
        <p className={subtitleClassName}>{t(subtitleKey)}</p>
      ) : null}
    </>
  );
}

export function AuthPageFooter() {
  const t = useT();
  return (
    <p className="mt-6 text-center text-xs text-ink-soft">
      <Link
        href="/terminos"
        className="text-ink underline-offset-2 hover:underline"
      >
        {t("auth.conditions")}
      </Link>
      {" · "}
      <Link
        href="/privacidad"
        className="text-ink underline-offset-2 hover:underline"
      >
        {t("auth.privacy")}
      </Link>
    </p>
  );
}

export function AuthLoadingFallback() {
  const t = useT();
  return <p className="text-sm text-ink-soft">{t("common.loading")}</p>;
}
