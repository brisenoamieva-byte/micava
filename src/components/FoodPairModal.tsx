"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AiTheaterStatus } from "@/components/AiTheaterStatus";
import { useLocale, useT } from "@/lib/i18n";
import { clientCountryCodeHint } from "@/lib/market-geo";
import {
  slimWinesForPairMeal,
  type PairMealResult,
} from "@/lib/pair-meal";
import type { Wine } from "@/lib/types";
import { formatCavataleRating } from "@/lib/wines";

type Props = {
  open: boolean;
  wines: Wine[];
  onClose: () => void;
  /** Open the recommended bottle in detail. */
  onOpenWine: (wineId: string) => void;
};

export function FoodPairModal({ open, wines, onClose, onOpenWine }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [dish, setDish] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PairMealResult | null>(null);
  const [askedDish, setAskedDish] = useState("");

  useEffect(() => {
    if (!open) return;
    setDish("");
    setLoading(false);
    setError("");
    setResult(null);
    setAskedDish("");
  }, [open]);

  if (!open) return null;

  const wineById = new Map(wines.map((w) => [w.id, w]));
  const pick = result ? wineById.get(result.wineId) : null;

  async function runPair(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = dish.trim();
    if (trimmed.length < 2) {
      setError(t("foodPair.needDish"));
      return;
    }
    if (wines.length === 0) {
      setError(t("foodPair.emptyCellar"));
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setAskedDish(trimmed);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 55_000);

    try {
      const countryCode = clientCountryCodeHint();
      const res = await fetch("/api/pair-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          dish: trimmed,
          locale,
          wines: slimWinesForPairMeal(wines),
          ...(countryCode ? { countryCode } : {}),
        }),
      });
      const raw = await res.text();
      let payload: {
        error?: string;
        recommendation?: PairMealResult;
      } = {};
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(t("errors.generic"));
      }
      if (!res.ok || !payload.recommendation) {
        throw new Error(payload.error || t("foodPair.failed"));
      }
      setResult(payload.recommendation);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(t("foodPair.timeout"));
      } else {
        setError(
          err instanceof Error ? err.message : t("foodPair.failed")
        );
      }
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  function wineLine(w: Wine): string {
    const bits = [
      w.name,
      w.winery || null,
      w.vintage != null ? String(w.vintage) : null,
    ].filter(Boolean);
    return bits.join(" · ");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,18,16,0.45)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-pair-title"
      onClick={onClose}
    >
      <div
        className="panel max-h-[92dvh] w-full max-w-md overflow-y-auto p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
          Cavatale
        </p>
        <h2 id="food-pair-title" className="display mt-1 text-3xl text-ink">
          {t("foodPair.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t("foodPair.lead")}</p>

        <form className="mt-4 space-y-3" onSubmit={(e) => void runPair(e)}>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              {t("foodPair.dishLabel")}
            </span>
            <textarea
              className="min-h-[88px] w-full resize-y rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2.5 text-sm text-ink outline-none focus:border-[rgba(110,31,44,0.45)]"
              value={dish}
              onChange={(e) => setDish(e.target.value)}
              placeholder={t("foodPair.placeholder")}
              maxLength={400}
              disabled={loading}
              autoFocus
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="btn btn-primary min-h-[44px] flex-1 px-4 text-sm"
              disabled={loading || wines.length === 0}
            >
              {loading ? t("foodPair.thinking") : t("foodPair.submit")}
            </button>
            <button
              type="button"
              className="btn btn-ghost min-h-[44px] px-4 text-sm"
              onClick={onClose}
              disabled={loading}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
          <AiTheaterStatus active={loading} />
          {error ? (
            <p className="text-sm text-[var(--wine)]">{error}</p>
          ) : null}

          {!loading && result && pick ? (
            <div className="space-y-3 reveal-in">
              {askedDish ? (
                <p className="text-xs text-ink-soft">
                  {t("foodPair.forDish")}{" "}
                  <span className="text-ink">«{askedDish}»</span>
                </p>
              ) : null}
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("foodPair.pick")}
                </p>
                <p className="display mt-1 text-[1.45rem] leading-snug text-ink">
                  {wineLine(pick)}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {[
                    pick.type,
                    pick.grape || null,
                    pick.slot ? `${t("foodPair.slot")} ${pick.slot}` : null,
                    pick.cavataleRating != null
                      ? `${formatCavataleRating(pick.cavataleRating)} Cavatale`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="rounded-[8px] border border-[rgba(110,31,44,0.16)] bg-[rgba(110,31,44,0.05)] px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
                  {t("foodPair.why")}
                </p>
                {result.matchNote ? (
                  <p className="mt-1.5 text-sm font-medium text-ink">
                    {result.matchNote}
                  </p>
                ) : null}
                <p className="mt-1.5 text-sm leading-relaxed text-ink">
                  {result.reason}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary min-h-[48px] w-full text-base"
                onClick={() => {
                  onOpenWine(result.wineId);
                  onClose();
                }}
              >
                {t("foodPair.openBottle")}
              </button>

              {result.alternatives.length > 0 ? (
                <div className="space-y-2 border-t border-[var(--line)] pt-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    {t("foodPair.alternatives")}
                  </p>
                  <ul className="space-y-2">
                    {result.alternatives.map((alt) => {
                      const w = wineById.get(alt.wineId);
                      if (!w) return null;
                      return (
                        <li key={alt.wineId}>
                          <button
                            type="button"
                            className="w-full rounded-[8px] border border-[rgba(110,31,44,0.18)] bg-[rgba(110,31,44,0.05)] px-3 py-2.5 text-left transition hover:bg-[rgba(110,31,44,0.1)]"
                            onClick={() => {
                              onOpenWine(alt.wineId);
                              onClose();
                            }}
                          >
                            <p className="text-sm font-medium text-ink">
                              {wineLine(w)}
                            </p>
                            <p className="mt-0.5 text-xs leading-snug text-ink-soft">
                              {alt.reason}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {!loading && !result && !error ? (
            <p className="text-sm text-ink-soft">{t("foodPair.hint")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
