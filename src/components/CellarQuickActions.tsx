"use client";

import { useT } from "@/lib/i18n";

type Props = {
  onScan: () => void;
  onOpenTonight: () => void;
  onFind: () => void;
  openTonightDisabled?: boolean;
  findDisabled?: boolean;
};

/** Three primary decisions — scan, open tonight, find on map. */
export function CellarQuickActions({
  onScan,
  onOpenTonight,
  onFind,
  openTonightDisabled,
  findDisabled,
}: Props) {
  const t = useT();

  return (
    <section
      className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3"
      aria-label={t("cava.quickActionsLabel")}
    >
      <button
        type="button"
        className="btn btn-primary flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-2 py-2 text-center sm:min-h-[56px]"
        onClick={onScan}
      >
        <span className="text-sm font-medium leading-tight">
          {t("cava.quickScan")}
        </span>
        <span className="text-[10px] font-normal opacity-90 sm:text-[11px]">
          {t("cava.quickScanHint")}
        </span>
      </button>
      <button
        type="button"
        className="btn btn-ghost flex min-h-[52px] flex-col items-center justify-center gap-0.5 border border-[var(--line)] px-2 py-2 text-center disabled:opacity-45 sm:min-h-[56px]"
        onClick={onOpenTonight}
        disabled={openTonightDisabled}
      >
        <span className="text-sm font-medium leading-tight text-ink">
          {t("cava.quickOpenTonight")}
        </span>
        <span className="text-[10px] text-ink-soft sm:text-[11px]">
          {t("cava.quickOpenTonightHint")}
        </span>
      </button>
      <button
        type="button"
        className="btn btn-ghost flex min-h-[52px] flex-col items-center justify-center gap-0.5 border border-[var(--line)] px-2 py-2 text-center disabled:opacity-45 sm:min-h-[56px]"
        onClick={onFind}
        disabled={findDisabled}
      >
        <span className="text-sm font-medium leading-tight text-ink">
          {t("cava.quickFind")}
        </span>
        <span className="text-[10px] text-ink-soft sm:text-[11px]">
          {t("cava.quickFindHint")}
        </span>
      </button>
    </section>
  );
}
