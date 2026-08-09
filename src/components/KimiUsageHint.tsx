"use client";

import { useEffect, useState } from "react";

type ProviderSlice = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
};

type UsagePayload = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
  byProvider?: {
    kimi?: ProviderSlice;
    gemini?: ProviderSlice;
    other?: ProviderSlice;
  };
  total?: ProviderSlice;
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

function sliceLine(label: string, slice: ProviderSlice | undefined): string | null {
  if (!slice || slice.calls <= 0) return null;
  return `${label} ${formatTokens(slice.totalTokens)} · ~${formatUsd(slice.estimatedUsd)}`;
}

/**
 * Month-to-date AI spend for the signed-in user (Kimi + Gemini + total).
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

  const kimi = data.byProvider?.kimi;
  const gemini = data.byProvider?.gemini;
  const totalUsd = data.total?.estimatedUsd ?? data.estimatedUsd;
  const totalTok = data.total?.totalTokens ?? data.totalTokens;

  const parts = [
    sliceLine("Kimi", kimi),
    sliceLine("Gemini", gemini),
  ].filter(Boolean);

  const title = [
    "Uso estimado de IA este mes",
    kimi && kimi.calls > 0
      ? `Kimi K2.6: ${formatTokens(kimi.totalTokens)} tok · ~${formatUsd(kimi.estimatedUsd)}`
      : null,
    gemini && gemini.calls > 0
      ? `Gemini Flash-Lite: ${formatTokens(gemini.totalTokens)} tok · ~${formatUsd(gemini.estimatedUsd)}`
      : null,
    `Total: ${formatTokens(totalTok)} tok · ~${formatUsd(totalUsd)}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <span title={title}>
      IA este mes
      {parts.length > 0 ? (
        <>
          {" · "}
          {parts.join(" · ")}
          {" · "}
          Total ~{formatUsd(totalUsd)}
        </>
      ) : (
        <>
          {" · "}
          {formatTokens(totalTok)} tok · ~{formatUsd(totalUsd)} USD
        </>
      )}
    </span>
  );
}
