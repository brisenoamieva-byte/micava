"use client";

import { useEffect, useState } from "react";

type UsagePayload = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
  error?: string;
};

function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return "< $0.01";
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Discreet month-to-date Kimi spend for the signed-in user.
 */
export function KimiUsageHint() {
  const [data, setData] = useState<UsagePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/kimi-usage");
        const json = (await res.json()) as UsagePayload & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          // Missing migration / not signed in — stay silent.
          setData(null);
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.calls <= 0) return null;

  return (
    <span title="Uso estimado de Kimi este mes (tarifas K2.6)">
      IA este mes · {formatTokens(data.totalTokens)} tok ·{" "}
      ~{formatUsd(data.estimatedUsd)} USD
    </span>
  );
}
