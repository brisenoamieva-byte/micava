"use client";

import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
  /** Status copy beside the mark (Spanish OK). */
  label?: ReactNode;
  className?: string;
  size?: "sm" | "md";
  /** `cream` on burgundy buttons; `wine` on cream UI. */
  tone?: "wine" | "cream";
  /** Soft bouncing dots after the mark. Default true. */
  dots?: boolean;
};

const markPx = { sm: 16, md: 20 } as const;

/**
 * Subtle “thinking” cue for Kimi / scan flows: brand mark pulse + dots.
 * Prefer over bare loading text.
 */
export function ThinkingIndicator({
  label,
  className = "",
  size = "md",
  tone = "wine",
  dots = true,
}: Props) {
  const px = markPx[size];
  const ink =
    tone === "cream" ? "text-[rgba(250,247,241,0.92)]" : "text-ink-soft";
  const dot =
    tone === "cream" ? "bg-[rgba(250,247,241,0.85)]" : "bg-[var(--wine-soft)]";

  return (
    <span
      className={`thinking-indicator inline-flex max-w-full items-center gap-2 ${ink} ${className}`.trim()}
      data-tone={tone}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="thinking-mark relative inline-flex shrink-0" aria-hidden>
        <Image
          src="/brand/cavatale-mark.png"
          alt=""
          width={px}
          height={px}
          className="rounded-[4px]"
        />
        <span className="thinking-spark" />
      </span>
      {dots ? (
        <span className="thinking-dots inline-flex items-center gap-[3px]" aria-hidden>
          <span className={`thinking-dot h-[3px] w-[3px] rounded-full ${dot}`} />
          <span className={`thinking-dot h-[3px] w-[3px] rounded-full ${dot}`} />
          <span className={`thinking-dot h-[3px] w-[3px] rounded-full ${dot}`} />
        </span>
      ) : null}
      {label != null ? (
        <span className="min-w-0 text-sm leading-snug">{label}</span>
      ) : null}
    </span>
  );
}
