"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Buscando personas detrás…",
  "Afinando el gancho…",
  "Preparando maridaje…",
] as const;

const INTERVAL_MS = 3200;

type Props = {
  active: boolean;
  className?: string;
};

/** Staged Spanish status lines while Kimi research runs. */
export function AiTheaterStatus({ active, className = "" }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    setIndex(0);
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % STAGES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <p
      className={`text-sm text-ink-soft ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {STAGES[index]}
    </p>
  );
}
