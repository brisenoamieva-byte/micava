"use client";

import { useT } from "@/lib/i18n";

type FirstRunGuideProps = {
  /** Full empty-cava welcome, compact reminder, or one-shot next step after first bottle. */
  variant?: "welcome" | "compact" | "story-next";
  onScan: () => void;
  /** Optional: open the form without going through scan chooser. */
  onManual?: () => void;
  onDismiss?: () => void;
  /** Go to Detalle / focus story CTA (story-next). */
  onTellStory?: () => void;
};

/**
 * Plain-language first-run guide — start by adding your own bottles.
 */
export function FirstRunGuide({
  variant = "welcome",
  onScan,
  onManual,
  onDismiss,
  onTellStory,
}: FirstRunGuideProps) {
  const t = useT();

  const steps = [
    {
      n: "1",
      title: t("guide.step1Title"),
      body: t("guide.step1Body"),
    },
    {
      n: "2",
      title: t("guide.step2Title"),
      body: t("guide.step2Body"),
    },
    {
      n: "3",
      title: t("guide.step3Title"),
      body: t("guide.step3Body"),
    },
  ];

  if (variant === "story-next") {
    return (
      <section className="discovery-stage mt-5 sm:mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
              {t("guide.storyNextLabel")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink sm:text-[15px]">
              {t("guide.storyNextBody")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {onTellStory ? (
              <button
                type="button"
                className="btn btn-primary min-h-[40px] px-3 text-sm"
                onClick={onTellStory}
              >
                {t("guide.tellStory")}
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                onClick={onDismiss}
              >
                {t("guide.skip")}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "compact") {
    return (
      <section className="mt-5 rounded-[12px] border border-[var(--line)] bg-[rgba(255,252,247,0.72)] px-4 py-3 sm:mt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
              {t("guide.compactLabel")}
            </p>
            <p className="mt-1 text-sm text-ink">{t("guide.compactBody")}</p>
          </div>
          {onDismiss ? (
            <button
              type="button"
              className="shrink-0 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
              onClick={onDismiss}
            >
              {t("common.dismiss")}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="discovery-stage mt-6 sm:mt-8">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--wine)]">
        {t("guide.welcomeLabel")}
      </p>
      <h2 className="display mt-2 text-[1.85rem] leading-tight text-ink sm:text-3xl">
        {t("guide.welcomeTitle")}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-[15px]">
        {t("guide.welcomeLead")}
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          className="btn btn-primary min-h-[48px] w-full px-4 text-base sm:w-auto"
          onClick={onScan}
        >
          {t("wine.scanLabel")}
        </button>
        {onManual ? (
          <button
            type="button"
            className="btn btn-ghost min-h-[48px] w-full border border-[var(--line)] px-4 text-base sm:w-auto"
            onClick={onManual}
          >
            {t("guide.writeManual")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost min-h-[48px] w-full border border-[var(--line)] px-4 text-base sm:w-auto"
            onClick={onScan}
          >
            {t("guide.addBottle")}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-soft">{t("guide.compactLabel")}</p>

      <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink-soft">
        {t("guide.furnitureHint")}
      </p>

      <ol className="mt-6 space-y-4 border-t border-[rgba(110,31,44,0.14)] pt-5">
        {steps.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span
              className="display flex h-8 w-8 shrink-0 items-center justify-center text-lg text-[var(--wine)]"
              aria-hidden
            >
              {step.n}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-ink">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
