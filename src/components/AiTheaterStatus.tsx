"use client";

import { useEffect, useMemo, useState } from "react";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { useT } from "@/lib/i18n";

const STAGE_KEYS = [
  "ai.searchingPeople",
  "ai.refiningHook",
  "ai.preparingPairing",
] as const;

const INTERVAL_MS = 3200;

type Props = {
  active: boolean;
  className?: string;
};

/** Staged status lines while Kimi research runs. */
export function AiTheaterStatus({ active, className = "" }: Props) {
  const t = useT();
  const stages = useMemo(
    () => STAGE_KEYS.map((key) => t(key)),
    [t]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    setIndex(0);
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % stages.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, stages.length]);

  if (!active) return null;

  return (
    <ThinkingIndicator
      className={className}
      tone="wine"
      size="md"
      label={stages[index]}
    />
  );
}
