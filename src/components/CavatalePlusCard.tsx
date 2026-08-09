"use client";

import { useEffect, useState } from "react";
import {
  CAVATALE_PLUS,
  countStoryCallsThisMonth,
  freeStoryQuotaRemaining,
} from "@/lib/cavatale-plus";
import { useT } from "@/lib/i18n";

type UsagePayload = {
  byRoute?: Record<string, number>;
  calls?: number;
};

/**
 * Measurement + Plus design card (no paywall). Shows free story quota vs plan.
 */
export function CavatalePlusCard() {
  const t = useT();
  const [used, setUsed] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/kimi-usage");
        if (!res.ok) return;
        const json = (await res.json()) as UsagePayload;
        if (cancelled) return;
        setUsed(countStoryCallsThisMonth(json.byRoute));
      } catch {
        if (!cancelled) setUsed(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const limit = CAVATALE_PLUS.freeStoriesPerMonth;
  const remaining =
    used == null ? null : freeStoryQuotaRemaining(used, limit);
  const pct =
    used == null ? 0 : Math.min(100, Math.round((used / limit) * 100));

  return (
    <section className="panel-quiet px-4 py-4 sm:px-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
        {t("plus.label")}
      </p>
      <h3 className="display mt-1 text-xl text-ink">{t("plus.title")}</h3>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">{t("plus.lead")}</p>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium text-ink">{t("plus.storiesQuota")}</span>
          <span className="tabular-nums text-ink-soft">
            {used == null
              ? t("plus.storiesQuotaUnknown")
              : t("plus.storiesQuotaUsed", { used, limit })}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(26,23,20,0.08)]">
          <div
            className="h-full rounded-full bg-[var(--wine)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {remaining != null ? (
          <p className="mt-1.5 text-xs text-ink-soft">
            {remaining > 0
              ? t("plus.storiesRemaining", { count: remaining })
              : t("plus.storiesExhausted")}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-ink">
        <li>· {t("plus.include.storiesUnlimited")}</li>
        <li>· {t("plus.include.openTonight")}</li>
        <li>· {t("plus.include.drinkWindows")}</li>
        <li>· {t("plus.include.valueRefresh")}</li>
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        {t("plus.pricingHint", {
          mxn: CAVATALE_PLUS.plannedPriceMxnYear,
          usd: CAVATALE_PLUS.plannedPriceUsdYear,
        })}
      </p>
    </section>
  );
}
