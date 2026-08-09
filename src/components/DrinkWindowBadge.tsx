"use client";

import { drinkStatus, type DrinkStatus } from "@/lib/drink-window";
import { useT } from "@/lib/i18n";
import type { Wine } from "@/lib/types";

type Props = {
  wine: Pick<Wine, "vintage" | "type" | "aging">;
  /** compact = chip; inline = text under meta */
  size?: "sm" | "md";
  className?: string;
};

const STATUS_CLASS: Record<DrinkStatus, string> = {
  peak: "border-[rgba(110,31,44,0.35)] bg-[rgba(110,31,44,0.1)] text-[var(--wine-deep)]",
  ready: "border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] text-[var(--wine)]",
  young: "border-[var(--line)] bg-[rgba(255,252,247,0.7)] text-ink-soft",
  late: "border-[rgba(122,80,40,0.35)] bg-[rgba(122,80,40,0.08)] text-[var(--oak)]",
  unknown: "border-[var(--line)] bg-transparent text-ink-soft",
};

export function DrinkWindowBadge({ wine, size = "sm", className = "" }: Props) {
  const t = useT();
  const status = drinkStatus(wine);
  if (status === "unknown") return null;

  return (
    <span
      className={[
        "inline-flex items-center rounded-[6px] border font-medium uppercase tracking-[0.08em]",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        STATUS_CLASS[status],
        className,
      ].join(" ")}
      title={t(`drinkWindow.hint.${status}`)}
    >
      {t(`drinkWindow.status.${status}`)}
    </span>
  );
}
