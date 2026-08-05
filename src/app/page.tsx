"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { BrandWordmark } from "@/components/BrandWordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/auth-store";
import { useCellar } from "@/lib/cellar-store";
import { useT } from "@/lib/i18n";
import { cellarStats, formatPrice } from "@/lib/wines";

export default function HomePage() {
  const t = useT();
  const { user, ready } = useAuth();
  const { wines } = useCellar();
  const stats = cellarStats(wines);
  const loggedIn = Boolean(user);

  const steps = [
    { n: "01", title: t("landing.step1Title"), body: t("landing.step1Body") },
    { n: "02", title: t("landing.step2Title"), body: t("landing.step2Body") },
    { n: "03", title: t("landing.step3Title"), body: t("landing.step3Body") },
  ];

  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6 md:px-10">
        <header className="fade-up flex items-center justify-between gap-4">
          <BrandMark size="md" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact className="hidden sm:inline-flex" />
            {ready && loggedIn ? (
              <Link href="/cava" className="btn btn-ghost min-h-[44px] px-4 text-sm">
                {t("landing.myCellar")}
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost min-h-[44px] px-4 text-sm">
                  {t("landing.enter")}
                </Link>
                <Link
                  href="/registro"
                  className="btn btn-primary min-h-[44px] px-4 text-sm"
                >
                  {t("landing.createCellar")}
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="relative flex flex-1 flex-col justify-center py-12 sm:py-16 md:py-20">
          <div className="pointer-events-none absolute inset-y-0 right-[-10%] hidden w-[58%] md:block">
            <div className="hero-silhouette h-full w-full" />
          </div>

          <div className="relative max-w-xl">
            <h1 className="fade-up leading-none text-ink">
              <BrandWordmark size="hero" />
            </h1>
            <p className="fade-up-delay mt-5 max-w-lg text-base leading-relaxed text-ink-soft sm:mt-6 sm:text-lg md:text-[1.25rem] md:leading-snug">
              {t("landing.hero")}
            </p>

            <div className="fade-up-delay-2 mt-8 flex flex-col items-start gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                href={loggedIn ? "/cava" : "/registro"}
                className="btn btn-primary min-h-[48px] w-full text-base sm:w-auto"
              >
                {loggedIn ? t("landing.openMyCellar") : t("landing.createMyCellar")}
              </Link>
              {!loggedIn ? (
                <Link
                  href="/login"
                  className="text-sm text-[#4f4a43] underline-offset-2 hover:underline"
                >
                  {t("landing.haveAccount")}
                </Link>
              ) : (
                <p className="text-sm text-[#4f4a43]">
                  {t("landing.bottlesValue", {
                    bottles: stats.bottles,
                    value: formatPrice(stats.value),
                  })}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <section
        id="como"
        className="relative z-10 border-t border-[var(--line)] bg-[rgba(250,249,245,0.45)]"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 md:px-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            {t("landing.howTitle")}
          </p>
          <h2 className="display mt-2 max-w-lg text-3xl text-ink sm:text-4xl">
            {t("landing.howHeadline")}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft sm:text-base">
            {t("landing.howLead")}
          </p>

          <ol className="mt-12 grid gap-10 sm:mt-14 sm:grid-cols-3 sm:gap-8">
            {steps.map((step) => (
              <li key={step.n} className="min-w-0">
                <p className="display text-4xl leading-none text-[var(--wine)] sm:text-5xl">
                  {step.n}
                </p>
                <h3 className="mt-4 text-lg font-medium text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-14 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Link
              href={loggedIn ? "/cava" : "/registro"}
              className="btn btn-primary min-h-[48px] w-full text-base sm:w-auto"
            >
              {loggedIn ? t("landing.openMyCellar") : t("landing.startFree")}
            </Link>
            <p className="text-sm text-ink-soft">{t("landing.betaNote")}</p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[var(--line)] px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
          <BrandWordmark size="sm" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <LanguageSwitcher compact className="sm:hidden" />
            <Link
              href="/privacidad"
              className="underline-offset-2 hover:text-ink hover:underline"
            >
              {t("landing.footerPrivacy")}
            </Link>
            <Link
              href="/terminos"
              className="underline-offset-2 hover:text-ink hover:underline"
            >
              {t("landing.footerTerms")}
            </Link>
            <p>cavatale.com</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
