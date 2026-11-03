"use client";

import { drinkStatus, type DrinkStatus } from "@/lib/drink-window";
import { useT } from "@/lib/i18n";
import type { Wine } from "@/lib/types";

type Props = {
  wine: Pick<Wine, "vintage" | "type" | "aging" | "grape" | "region" | "country">;
  /** compact = chip; inline = text under meta */
  size?: "sm" | "md";
  className?: string;
};

/** Distinct hues so Pico / En su punto / Joven / Tarde scan at a glance. */
export const DRINK_STATUS_CLASS: Record<DrinkStatus, string> = {
  peak:
    "border-[rgba(110,31,44,0.5)] bg-[rgba(110,31,44,0.18)] text-[var(--wine-deep)]",
  ready:
    "border-[rgba(47,66,52,0.42)] bg-[rgba(47,66,52,0.14)] text-[var(--leaf)]",
  young:
    "border-[rgba(44,74,102,0.38)] bg-[rgba(44,74,102,0.1)] text-[#2c4a66]",
  late:
    "border-[rgba(138,106,69,0.48)] bg-[rgba(138,106,69,0.16)] text-[var(--oak)]",
  unknown: "border-[var(--line)] bg-transparent text-ink-soft",
};

export const DRINK_STATUS_DOT: Record<
  Exclude<DrinkStatus, "unknown">,
  string
> = {
  peak: "bg-[var(--wine)]",
  ready: "bg-[var(--leaf)]",
  young: "bg-[#3a6a8c]",
  late: "bg-[var(--oak)]",
};

export function DrinkWindowBadge({ wine, size = "sm", className = "" }: Props) {
  const t = useT();
  const status = drinkStatus(wine);
  if (status === "unknown") return null;

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-[6px] border font-medium uppercase tracking-[0.08em]",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        DRINK_STATUS_CLASS[status],
        className,
      ].join(" ")}
      title={t(`drinkWindow.hint.${status}`)}
    >
      <span
        className={[
          "inline-block shrink-0 rounded-full",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
          DRINK_STATUS_DOT[status],
        ].join(" ")}
        aria-hidden
      />
      {t(`drinkWindow.status.${status}`)}
    </span>
  );
}
