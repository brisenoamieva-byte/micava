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

  if (variant === "story-next") {
    return (
      <section className="mt-5 rounded-[12px] border border-[var(--line)] bg-[rgba(255,252,247,0.72)] px-4 py-3 sm:mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-sm leading-relaxed text-ink">
            {t("guide.storyNextBody")}
          </p>
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
          <p className="text-sm text-ink">{t("guide.compactBody")}</p>
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
    <section className="mt-6 sm:mt-8">
      <h2 className="display text-[1.85rem] leading-tight text-ink sm:text-3xl">
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
    </section>
  );
}
