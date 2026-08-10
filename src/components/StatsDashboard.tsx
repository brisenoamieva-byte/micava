"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { CellarLogEntry, CellarUnit, Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { DrinkWindowBadge } from "@/components/DrinkWindowBadge";
import { DrinkWindowNotifyOptIn } from "@/components/DrinkWindowNotifyOptIn";
import { buildInsights, qualityScore, uniqueWinesByIdentity, type ReplenishItem } from "@/lib/analytics";
import {
  computeDrinkWindow,
  groupWinesByDrinkStatus,
  type DrinkStatus,
} from "@/lib/drink-window";
import { useLocale, useT, wineTypeLabel } from "@/lib/i18n";
import {
  cellarValueSnapshot,
  rankOpenTonight,
  winesNeedingPriceRefresh,
} from "@/lib/open-tonight";
import {
  countryDisplayName,
  formatCavataleRating,
  formatPrice,
} from "@/lib/wines";

type MarketRefreshProgress = {
  done: number;
  total: number;
};

type MarketRefreshResult = {
  updated: number;
  failed: number;
  cancelled: boolean;
};

type Props = {
  wines: Wine[];
  cellars?: CellarUnit[];
  history?: CellarLogEntry[];
  onSelectWine?: (wine: Wine) => void;
  /** Refresh reference prices for up to N stale bottles (AI). */
  onRefreshPrices?: (wines: Wine[]) => Promise<number> | number;
  /**
   * Batch refresh score + market price for all unique SKUs (no story rewrite).
   */
  onRefreshMarket?: (
    wines: Wine[],
    opts: {
      signal: AbortSignal;
      onProgress: (p: MarketRefreshProgress) => void;
    }
  ) => Promise<MarketRefreshResult>;
};

export function StatsDashboard({
  wines,
  cellars = [],
  history = [],
  onSelectWine,
  onRefreshPrices,
  onRefreshMarket,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const insights = useMemo(
    () => buildInsights(wines, cellars, history),
    [wines, cellars, history]
  );
  const openTonight = useMemo(() => rankOpenTonight(wines, 5), [wines]);
  const byMoment = useMemo(() => groupWinesByDrinkStatus(wines), [wines]);
  const valueSnap = useMemo(() => cellarValueSnapshot(wines), [wines]);
  const priceTargets = useMemo(
    () => winesNeedingPriceRefresh(wines, 5),
    [wines]
  );
  const marketTargets = useMemo(
    () => uniqueWinesByIdentity(wines),
    [wines]
  );
  const marketBottleCount = wines.length;
  const marketDuplicateExtra = Math.max(
    0,
    marketBottleCount - marketTargets.length
  );
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceHint, setPriceHint] = useState<string | null>(null);
  const [marketBusy, setMarketBusy] = useState(false);
  const [marketHint, setMarketHint] = useState<string | null>(null);
  const [marketProgress, setMarketProgress] = useState<MarketRefreshProgress | null>(
    null
  );
  const marketAbortRef = useRef<AbortController | null>(null);
  const maxCountry = Math.max(...insights.byCountry.map((c) => c.count), 1);
  const maxVintage = Math.max(...insights.vintages.map((v) => v.count), 1);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const vintageWines = useMemo(() => {
    if (selectedYear == null) return [];
    return wines
      .filter((w) => w.vintage === selectedYear)
      .sort(
        (a, b) =>
          (qualityScore(b) ?? 0) - (qualityScore(a) ?? 0) ||
          a.name.localeCompare(b.name, "es")
      );
  }, [wines, selectedYear]);

  const regionWines = useMemo(() => {
    if (selectedRegion == null) return [];
    return wines
      .filter((w) => (w.region || "") === selectedRegion)
      .sort(
        (a, b) =>
          (qualityScore(b) ?? 0) - (qualityScore(a) ?? 0) ||
          a.name.localeCompare(b.name, "es")
      );
  }, [wines, selectedRegion]);

  const countryWines = useMemo(() => {
    if (selectedCountry == null) return [];
    return wines
      .filter((w) => (w.country || "") === selectedCountry)
      .sort(
        (a, b) =>
          (qualityScore(b) ?? 0) - (qualityScore(a) ?? 0) ||
          a.name.localeCompare(b.name, "es")
      );
  }, [wines, selectedCountry]);

  async function handleRefreshPrices() {
    if (!onRefreshPrices || priceBusy || priceTargets.length === 0) return;
    setPriceBusy(true);
    setPriceHint(null);
    try {
      const n = await onRefreshPrices(priceTargets);
      setPriceHint(t("stats.priceRefreshDone", { count: n }));
    } catch {
      setPriceHint(t("stats.priceRefreshFailed"));
    } finally {
      setPriceBusy(false);
    }
  }

  async function handleRefreshMarket() {
    if (!onRefreshMarket || marketBusy || marketTargets.length === 0) return;
    if (
      !confirm(
        t("stats.marketRefreshConfirm", {
          count: marketTargets.length,
          bottles: marketBottleCount,
          duplicates:
            marketDuplicateExtra > 0
              ? t("stats.marketRefreshDuplicates", {
                  extra: marketDuplicateExtra,
                })
              : "",
        })
      )
    ) {
      return;
    }
    marketAbortRef.current?.abort();
    const ac = new AbortController();
    marketAbortRef.current = ac;
    setMarketBusy(true);
    setMarketHint(null);
    setMarketProgress({ done: 0, total: marketTargets.length });
    let lastDone = 0;
    try {
      const result = await onRefreshMarket(marketTargets, {
        signal: ac.signal,
        onProgress: (p) => {
          lastDone = p.done;
          setMarketProgress(p);
        },
      });
      if (result.cancelled) {
        setMarketHint(
          t("stats.marketRefreshCancelled", {
            done: lastDone,
            total: marketTargets.length,
          })
        );
      } else {
        setMarketHint(
          t("stats.marketRefreshDone", {
            updated: result.updated,
            failed:
              result.failed > 0
                ? t("stats.marketRefreshFailedSuffix", {
                    count: result.failed,
                  })
                : "",
          })
        );
      }
    } catch {
      setMarketHint(t("stats.priceRefreshFailed"));
    } finally {
      setMarketBusy(false);
      setMarketProgress(null);
      marketAbortRef.current = null;
    }
  }

  function cancelMarketRefresh() {
    marketAbortRef.current?.abort();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="display text-3xl text-ink md:text-4xl">
            {t("stats.pulseTitle")}
          </h2>
          {onRefreshMarket ? (
            <p className="mt-1 text-xs text-ink-soft">
              {marketBusy
                ? t("stats.marketRefreshHint")
                : marketDuplicateExtra > 0
                  ? t("stats.marketRefreshLeadDupes", {
                      unique: marketTargets.length,
                      bottles: marketBottleCount,
                    })
                  : t("stats.marketRefreshLead")}
            </p>
          ) : null}
        </div>
        {onRefreshMarket ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-[44px] px-4 text-sm"
              disabled={marketBusy || marketTargets.length === 0}
              onClick={() => void handleRefreshMarket()}
            >
              {marketBusy && marketProgress
                ? t("stats.marketRefreshing", {
                    done: marketProgress.done,
                    total: marketProgress.total,
                  })
                : t("stats.marketRefreshCta", {
                    count: marketTargets.length,
                  })}
            </button>
            {marketBusy ? (
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] px-3 text-sm text-ink-soft"
                onClick={cancelMarketRefresh}
              >
                {t("stats.marketRefreshCancel")}
              </button>
            ) : null}
            {marketHint ? (
              <p className="basis-full text-xs text-ink-soft sm:basis-auto">
                {marketHint}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {openTonight.length > 0 ? (
        <section className="space-y-3">
          {(() => {
            const top = openTonight[0];
            const w = top.wine;
            const pairing = w.kimiPairings?.[0];
            const rest = openTonight.slice(1);
            return (
              <>
                <button
                  type="button"
                  onClick={() => onSelectWine?.(w)}
                  className="panel-focus relative w-full overflow-hidden px-4 py-5 text-left transition hover:border-[rgba(110,31,44,0.35)] sm:px-6 sm:py-6"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(110,31,44,0.1)_0%,transparent_45%,rgba(184,129,74,0.06)_100%)]"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--wine)]"
                  />
                  <p className="relative micro-label text-[var(--wine)]">
                    {t("stats.openTonight")}
                  </p>
                  <div className="relative mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="display text-3xl leading-none text-ink sm:text-4xl">
                          {w.name}
                        </h3>
                        <DrinkWindowBadge wine={w} size="md" />
                      </div>
                      <p className="mt-2 text-sm text-ink-soft">
                        {w.winery || t("stats.noWinery")}
                        {w.vintage != null ? ` · ${w.vintage}` : ""}
                        {w.slot ? ` · ${w.slot}` : ""}
                      </p>
                      {pairing ? (
                        <p className="mt-3 text-sm leading-snug text-ink">
                          {t("stats.openTonightPairing", { dish: pairing })}
                        </p>
                      ) : w.kimiTalkHook ? (
                        <p className="mt-3 text-sm leading-snug text-ink line-clamp-2">
                          {w.kimiTalkHook}
                        </p>
                      ) : null}
                      <span className="mt-4 inline-flex min-h-[40px] items-center text-sm font-medium text-[var(--wine)]">
                        {t("stats.openTonightCta")} →
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      {w.cavataleRating != null ? (
                        <>
                          <p className="display text-5xl leading-none text-ink sm:text-6xl">
                            {formatCavataleRating(w.cavataleRating)}
                          </p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                            {t("wine.rating")}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-ink-soft">
                          {t("stats.openTonightNoScore")}
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {rest.length > 0 ? (
                  <div className="panel-quiet px-3 py-3 sm:px-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                      {t("stats.openTonightAlso")}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {rest.map((pick) => {
                        const rw = pick.wine;
                        const rPair = rw.kimiPairings?.[0];
                        return (
                          <li key={rw.id}>
                            <button
                              type="button"
                              onClick={() => onSelectWine?.(rw)}
                              className="flex w-full items-start justify-between gap-3 rounded-[10px] px-2 py-2 text-left transition hover:bg-[rgba(110,31,44,0.06)]"
                            >
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate font-medium text-ink">
                                    {rw.name}
                                  </span>
                                  <DrinkWindowBadge wine={rw} />
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-ink-soft">
                                  {rw.winery || t("stats.noWinery")}
                                  {rw.vintage != null ? ` · ${rw.vintage}` : ""}
                                  {rw.slot ? ` · ${rw.slot}` : ""}
                                  {rPair ? ` · ${rPair}` : ""}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                {rw.cavataleRating != null ? (
                                  <span className="display block text-lg leading-none text-ink">
                                    {formatCavataleRating(rw.cavataleRating)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-ink-soft">—</span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            );
          })()}
        </section>
      ) : null}

      <section className="panel-quiet space-y-4 px-4 py-4 sm:px-5">
        <Header title={t("stats.byMoment")} />
        {byMoment.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("stats.byMomentEmpty")}</p>
        ) : (
          <div className="space-y-4">
            {byMoment.map((group) => (
              <MomentGroup
                key={group.status}
                status={group.status}
                wines={group.wines}
                onSelectWine={onSelectWine}
              />
            ))}
          </div>
        )}
      </section>

      {/* Secondary KPIs — after the open recommendation */}
      <section className="space-y-3">
        <div className="panel-quiet relative overflow-hidden px-4 py-4 sm:px-5">
          <p className="micro-label text-ink-soft">{t("stats.avgCavatale")}</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="display text-4xl leading-none text-ink sm:text-5xl">
              {formatCavataleRating(insights.avgCavatale)}
            </p>
            {insights.avgCavatale == null ? (
              <p className="mb-1 max-w-sm text-sm text-ink-soft">
                {t("stats.avgCavataleEmpty")}
              </p>
            ) : t("stats.avgCavataleHint") ? (
              <p className="mb-1 max-w-sm text-sm text-ink-soft">
                {t("stats.avgCavataleHint")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <KpiQuiet
            label={t("stats.bottles")}
            value={String(insights.bottles)}
            hint={t("stats.countriesCount", { count: insights.countries })}
          />
          <KpiQuiet
            label={t("stats.refValue")}
            value={formatPrice(valueSnap.inventoryValue)}
            hint={
              valueSnap.pricedCount > 0
                ? t("stats.valuePriced", { count: valueSnap.pricedCount })
                : t("stats.valueEmpty")
            }
          />
          <div className="panel-quiet col-span-2 flex items-center gap-3 px-3 py-3 sm:col-span-2">
            <OccupancyRing value={insights.occupancy} size="sm" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                {t("stats.occupancy")}
              </p>
              <p className="display mt-0.5 text-xl leading-none text-ink">
                {Math.round(insights.occupancy * 100)}%
              </p>
              <p className="mt-1 text-[11px] leading-snug text-ink-soft">
                {t("stats.occupancyOf", {
                  used: insights.totalSlots - insights.emptySlots,
                  total: insights.totalSlots,
                })}
                {" · "}
                {insights.unitCount > 1
                  ? t("stats.unitsCount", { count: insights.unitCount })
                  : insights.occupancyLabel}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-quiet px-4 py-4 sm:px-5">
        <Header title={t("stats.cellarValue")} />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              {t("stats.inventoryValue")}
            </p>
            <p className="display mt-1 text-2xl text-ink">
              {formatPrice(valueSnap.inventoryValue)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              {t("stats.marketRef")}
            </p>
            <p className="display mt-1 text-2xl text-ink">
              {valueSnap.kimiPricedCount > 0
                ? formatPrice(valueSnap.kimiRefValue)
                : "—"}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">
              {t("stats.vsMarket")}
            </p>
            <p className="display mt-1 text-2xl text-ink">
              {valueSnap.vsMarketCount > 0
                ? formatPrice(valueSnap.vsMarketDelta)
                : "—"}
            </p>
            {valueSnap.vsMarketCount > 0 && t("stats.vsMarketHint") ? (
              <p className="mt-0.5 text-[11px] text-ink-soft">
                {t("stats.vsMarketHint", { count: valueSnap.vsMarketCount })}
              </p>
            ) : null}
          </div>
        </div>
        {onRefreshPrices ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost min-h-[40px] border border-[var(--line)] px-3 text-sm"
                disabled={
                  priceBusy || marketBusy || priceTargets.length === 0
                }
                onClick={() => void handleRefreshPrices()}
              >
                {priceBusy
                  ? t("stats.priceRefreshing")
                  : t("stats.priceRefreshCta", {
                      count: priceTargets.length,
                    })}
              </button>
            </div>
            {priceHint ? (
              <p className="text-xs text-ink-soft">{priceHint}</p>
            ) : priceTargets.length === 0 && !priceHint ? (
              <p className="text-xs text-ink-soft">{t("stats.priceRefreshNone")}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <DrinkWindowNotifyOptIn wines={wines} />

      {insights.toReplenish.length > 0 ? (
        <ReplenishBlock items={insights.toReplenish} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {/* País */}
        <section className="panel-quiet p-4 sm:p-5">
          <Header title={t("stats.byCountry")} />
          <div className="mt-4 space-y-1.5">
            {insights.byCountry.map((c, i) => {
              const active = selectedCountry === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() =>
                    setSelectedCountry((prev) =>
                      prev === c.name ? null : c.name
                    )
                  }
                  aria-pressed={active}
                  className={[
                    "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[10px] px-2 py-2 text-left transition",
                    active
                      ? "bg-[rgba(110,31,44,0.1)]"
                      : "hover:bg-[rgba(26,23,20,0.04)]",
                  ].join(" ")}
                >
                  <CountryFlag country={c.name} size="sm" />
                  <div className="min-w-0">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">
                        {c.name === "__none__"
                          ? t("stats.noData")
                          : countryDisplayName(c.name, locale)}
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {c.count} · {Math.round(c.share * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[rgba(26,23,20,0.08)]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(c.count / maxCountry) * 100}%`,
                          background:
                            i === 0
                              ? "var(--wine)"
                              : i === 1
                                ? "var(--wine-soft)"
                                : "var(--oak)",
                        }}
                      />
                    </div>
                  </div>
                  <span className="hidden text-right text-xs text-ink-soft sm:block">
                    {formatPrice(c.value)}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedCountry != null ? (
            <DrilldownList
              title={
                <>
                  {t("stats.countryLabel")}{" "}
                  <strong>{countryDisplayName(selectedCountry, locale)}</strong>
                </>
              }
              wines={countryWines}
              onClose={() => setSelectedCountry(null)}
              onSelectWine={onSelectWine}
              subtitle={(w) =>
                `${w.winery || w.region}${w.vintage ? ` · ${w.vintage}` : ""}${w.slot ? ` · ${w.slot}` : ""}`
              }
            />
          ) : null}
        </section>

        {/* Tipo donut + bands */}
        <section className="panel-quiet p-4 sm:p-5">
          <Header title={t("stats.profile")} />
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <TypeDonut items={insights.byType} total={insights.bottles} />
            <div className="w-full flex-1 space-y-5">
              <BandBlock
                title={t("wine.rating")}
                emptyHint={t("stats.cavataleBandsEmpty")}
                bands={insights.cavataleBands}
                color="var(--wine)"
              />
              <BandBlock title={t("wine.price")} bands={insights.priceBands} color="var(--oak)" />
            </div>
          </div>
        </section>
      </div>

      {/* Vintages */}
      <section className="panel-quiet p-4 sm:p-5">
        <Header title={t("stats.vintagesTitle")} />
        {insights.vintages.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">{t("stats.noVintages")}</p>
        ) : (
          <>
            <div className="mt-5 flex items-end gap-1.5 overflow-x-auto pb-1 sm:gap-2">
              {insights.vintages.map((v) => {
                const active = selectedYear === v.year;
                return (
                  <button
                    key={v.year}
                    type="button"
                    onClick={() =>
                      setSelectedYear((prev) => (prev === v.year ? null : v.year))
                    }
                    className={[
                      "flex min-w-[2.1rem] flex-col items-center gap-1.5 rounded-[8px] px-0.5 py-1 transition",
                      active
                        ? "bg-[rgba(110,31,44,0.1)]"
                        : "hover:bg-[rgba(26,23,20,0.04)]",
                    ].join(" ")}
                    aria-pressed={active}
                    aria-label={t("stats.vintageAria", {
                      year: v.year,
                      count: v.count,
                    })}
                  >
                    <span className="text-[10px] font-medium text-ink">{v.count}</span>
                    <div
                      className={[
                        "w-full rounded-t-[6px] transition-all duration-700",
                        active ? "bg-[var(--wine)]" : "bg-[var(--wine)]/85",
                      ].join(" ")}
                      style={{
                        height: `${Math.max(12, (v.count / maxVintage) * 120)}px`,
                      }}
                    />
                    <span
                      className={[
                        "text-[10px]",
                        active ? "font-medium text-ink" : "text-ink-soft",
                      ].join(" ")}
                    >
                      {String(v.year).slice(2)}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedYear != null ? (
              <DrilldownList
                title={
                  <>
                    {t("stats.vintageLabel")} <strong>{selectedYear}</strong>
                  </>
                }
                wines={vintageWines}
                onClose={() => setSelectedYear(null)}
                onSelectWine={onSelectWine}
                subtitle={(w) =>
                  `${w.winery || w.region}${w.slot ? ` · ${w.slot}` : ""}`
                }
              />
            ) : null}
          </>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankList
          title={t("stats.topRated")}
          wines={insights.topByCavatale}
          metric={(w) =>
            w.cavataleRating != null
              ? `${t("wine.rating")} ${formatCavataleRating(w.cavataleRating)}`
              : "—"
          }
          onSelect={onSelectWine}
        />
        <RankList
          title={t("stats.topValue")}
          wines={insights.topByPrice}
          metric={(w) => formatPrice(w.price, w.priceCurrency)}
          onSelect={onSelectWine}
        />
      </div>

      {/* Regiones */}
      <section className="panel-quiet p-4 sm:p-5">
        <Header title={t("stats.regionsTitle")} />
        <div className="mt-4 flex flex-wrap gap-2">
          {insights.byRegion.map((r) => {
            const active = selectedRegion === r.name;
            return (
              <button
                key={r.name || "__empty"}
                type="button"
                onClick={() =>
                  setSelectedRegion((prev) => (prev === r.name ? null : r.name))
                }
                aria-pressed={active}
                className={[
                  "inline-flex items-baseline gap-1.5 rounded-[6px] px-2 py-1.5 text-sm transition",
                  active
                    ? "bg-[rgba(110,31,44,0.1)] text-ink"
                    : "text-ink hover:bg-[rgba(20,18,16,0.05)]",
                ].join(" ")}
              >
                <span className="font-medium">
                  {r.name === "__none__" || !r.name
                    ? t("stats.noRegion")
                    : r.name}
                </span>
                <span className="text-xs tabular-nums text-ink-soft">
                  {r.count}
                </span>
              </button>
            );
          })}
        </div>
        {selectedRegion != null ? (
          <DrilldownList
            title={
              <>
                {t("stats.regionLabel")}{" "}
                <strong>{selectedRegion || t("stats.noRegion")}</strong>
              </>
            }
            wines={regionWines}
            onClose={() => setSelectedRegion(null)}
            onSelectWine={onSelectWine}
            subtitle={(w) =>
              `${w.winery || w.country}${w.vintage ? ` · ${w.vintage}` : ""}${w.slot ? ` · ${w.slot}` : ""}`
            }
          />
        ) : null}
      </section>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="display text-2xl text-ink">{title}</h3>
      {subtitle ? (
        <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>
      ) : null}
    </div>
  );
}

const MOMENT_ACCENT: Record<Exclude<DrinkStatus, "unknown">, string> = {
  peak: "var(--wine-deep)",
  ready: "var(--wine)",
  late: "var(--oak)",
  young: "var(--ink-soft)",
};

function MomentGroup({
  status,
  wines,
  onSelectWine,
}: {
  status: DrinkStatus;
  wines: Wine[];
  onSelectWine?: (wine: Wine) => void;
}) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  if (status === "unknown") return null;
  const accent = MOMENT_ACCENT[status];
  const previewLimit = 8;
  const visible =
    showAll || wines.length <= previewLimit
      ? wines
      : wines.slice(0, previewLimit);
  const hidden = wines.length - visible.length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p
          className="text-[11px] font-medium uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          {t(`drinkWindow.status.${status}`)}
          <span className="ml-2 font-normal tabular-nums text-ink-soft">
            {wines.length}
          </span>
        </p>
      </div>
      <ul className="mt-2 space-y-1">
        {visible.map((w) => {
          const win = computeDrinkWindow(w);
          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onSelectWine?.(w)}
                className="flex w-full items-start justify-between gap-3 rounded-[10px] px-2 py-2 text-left transition hover:bg-[rgba(110,31,44,0.06)]"
              >
                <span className="min-w-0">
                  <span className="truncate font-medium text-ink">{w.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">
                    {w.winery || t("stats.noWinery")}
                    {w.vintage != null ? ` · ${w.vintage}` : ""}
                    {w.slot ? ` · ${w.slot}` : ""}
                    {win ? ` · ${win.drinkFrom}–${win.drinkBy}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {w.cavataleRating != null ? (
                    <span className="display block text-lg leading-none text-ink">
                      {formatCavataleRating(w.cavataleRating)}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-soft">—</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          className="mt-1 min-h-[36px] px-2 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          onClick={() => setShowAll(true)}
        >
          {t("stats.byMomentShowMore", { count: hidden })}
        </button>
      ) : null}
      {showAll && wines.length > previewLimit ? (
        <button
          type="button"
          className="mt-1 min-h-[36px] px-2 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          onClick={() => setShowAll(false)}
        >
          {t("stats.byMomentShowLess")}
        </button>
      ) : null}
    </div>
  );
}

function stars(n: number): string {
  return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}

function ReplenishBlock({ items }: { items: ReplenishItem[] }) {
  const t = useT();
  return (
    <section className="panel-quiet p-4 sm:p-5">
      <Header title={t("stats.replenish")} />
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={`${item.name}|${item.winery}`}
            className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-[10px] border border-transparent px-1 py-2"
          >
            <CountryFlag country={item.country} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{item.name}</p>
              <p className="truncate text-xs text-ink-soft">
                {item.winery || t("stats.noWinery")}
                <span className="ml-2 text-[var(--wine)]">{stars(item.myRating)}</span>
              </p>
              {item.note ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink">{item.note}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-right text-xs text-ink-soft">
              {item.inStock === 0 ? t("stats.empty") : t("stats.lastOne")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DrilldownList({
  title,
  wines,
  onClose,
  onSelectWine,
  subtitle,
}: {
  title: ReactNode;
  wines: Wine[];
  onClose: () => void;
  onSelectWine?: (wine: Wine) => void;
  subtitle: (w: Wine) => string;
}) {
  const t = useT();
  return (
    <div className="mt-5 border-t border-[var(--line)] pt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink">
          {title}
          <span className="text-ink-soft"> · {wines.length}</span>
        </p>
        <button
          type="button"
          className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      </div>
      <ul className="space-y-1">
        {wines.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => onSelectWine?.(w)}
              className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[10px] border border-transparent px-1 py-2 text-left transition hover:border-[var(--line)] hover:bg-[rgba(255,252,247,0.55)]"
            >
              <CountryFlag country={w.country} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">
                  {w.name}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {subtitle(w)}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs font-medium text-ink">
                {w.cavataleRating != null
                  ? `${t("wine.rating")} ${formatCavataleRating(w.cavataleRating)}`
                  : "—"}
                <span className="mt-0.5 block font-normal text-ink-soft">
                  {formatPrice(w.price, w.priceCurrency)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KpiQuiet({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel-quiet px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </p>
      <p className="display mt-1 text-xl leading-none text-ink sm:text-2xl">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-ink-soft">{hint}</p>
    </div>
  );
}

function OccupancyRing({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? 56 : 72;
  const r = size === "sm" ? 22 : 28;
  const stroke = size === "sm" ? 5.5 : 7;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, value)));
  const mid = dim / 2;
  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden>
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke="rgba(26,23,20,0.1)"
        strokeWidth={stroke}
      />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke="var(--wine)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${mid} ${mid})`}
        className="transition-all duration-700"
      />
    </svg>
  );
}

function donutAccent(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("blanco")) return "#c4a86a";
  if (t.includes("rosado")) return "#a86b76";
  return "var(--wine)";
}

function TypeDonut({
  items,
  total,
}: {
  items: { name: string; count: number; share: number }[];
  total: number;
}) {
  const t = useT();
  const { dict } = useLocale();
  const size = 152;
  const mid = size / 2;
  const stroke = 11;
  const r = 50;
  const c = 2 * Math.PI * r;
  let cursor = 0;
  return (
    <div className="shrink-0">
      <div
        className="relative mx-auto"
        style={{ width: size, height: size }}
        role="img"
        aria-label={t("stats.bottlesTotalAria", { count: total })}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
          aria-hidden
        >
          <circle
            cx={mid}
            cy={mid}
            r={r}
            fill="none"
            stroke="rgba(26,23,20,0.08)"
            strokeWidth={stroke}
          />
          <g transform={`rotate(-90 ${mid} ${mid})`}>
            {items.map((item) => {
              const len = c * item.share;
              const dash = `${len} ${c - len}`;
              const el = (
                <circle
                  key={item.name}
                  cx={mid}
                  cy={mid}
                  r={r}
                  fill="none"
                  stroke={donutAccent(item.name)}
                  strokeWidth={stroke}
                  strokeLinecap="butt"
                  strokeDasharray={dash}
                  strokeDashoffset={-cursor}
                  className="transition-all duration-700"
                />
              );
              cursor += len;
              return el;
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="display text-[2.125rem] leading-none tracking-tight text-ink tabular-nums">
            {total}
          </p>
          <p className="mt-2 text-[0.625rem] font-medium uppercase leading-none tracking-[0.2em] text-ink-soft">
            {t("stats.total")}
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-xs text-ink-soft">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: donutAccent(item.name) }}
            />
            {wineTypeLabel(dict, item.name)} · {item.count}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BandBlock({
  title,
  bands,
  color,
  emptyHint,
}: {
  title: string;
  bands: { label: string; count: number; share: number }[];
  color: string;
  emptyHint?: string;
}) {
  const t = useT();
  const total = bands.reduce((s, b) => s + b.count, 0);

  function bandLabel(label: string): string {
    if (
      label === "priceUpTo400" ||
      label === "price401to600" ||
      label === "price601to900" ||
      label === "priceOver900"
    ) {
      return t(`stats.${label}`);
    }
    return label;
  }

  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">{title}</p>
      {total === 0 && emptyHint ? (
        <p className="text-xs text-ink-soft">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {bands.map((b) => (
            <div key={b.label}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="text-ink">{bandLabel(b.label)}</span>
                <span className="text-ink-soft">{b.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(26,23,20,0.08)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${b.share * 100}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RankList({
  title,
  subtitle,
  wines,
  metric,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  wines: Wine[];
  metric: (w: Wine) => string;
  onSelect?: (wine: Wine) => void;
}) {
  const t = useT();
  return (
    <section className="panel-quiet p-4 sm:p-5">
      <Header title={title} subtitle={subtitle} />
      <ol className="mt-4 space-y-2">
        {wines.length === 0 ? (
          <li className="text-sm text-ink-soft">{t("stats.noMatches")}</li>
        ) : (
          wines.map((w, i) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onSelect?.(w)}
                className="grid w-full grid-cols-[1.5rem_auto_1fr_auto] items-center gap-2 rounded-[10px] border border-transparent px-1 py-2 text-left transition hover:border-[var(--line)] hover:bg-[rgba(255,252,247,0.55)]"
              >
                <span className="text-sm text-ink-soft">{i + 1}</span>
                <CountryFlag country={w.country} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{w.name}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {w.region} · {w.vintage ?? t("wine.naVintage")}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs font-medium text-ink">
                  {metric(w)}
                </span>
              </button>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
