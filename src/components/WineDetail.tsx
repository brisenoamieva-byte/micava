"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { parseGrapes } from "@/lib/grapes";
import {
  isThinKimiStory,
  normalizeUserCorrectionNote,
  type KimiResearch,
} from "@/lib/kimi-research";
import { resolveLabelImageUrl } from "@/lib/label-image";
import { resolvePairingsForWine } from "@/lib/pairings";
import { confidenceLabel, formatCheckedAt } from "@/lib/rating-verify";
import { formatCavataleRating, formatPrice, resolvePriceCurrency, typeAccent } from "@/lib/wines";
import { DrinkWindowBadge } from "@/components/DrinkWindowBadge";
import { computeDrinkWindow } from "@/lib/drink-window";
import { buildWineShareText, shareOrCopyText } from "@/lib/share-wine";
import { useLocale, useT, wineTypeLabel } from "@/lib/i18n";
import { clientCountryCodeHint } from "@/lib/market-geo";
import { AiTheaterStatus } from "@/components/AiTheaterStatus";
import { CavataleRatingCard } from "@/components/CavataleRatingCard";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";

type Props = {
  wine: Wine | null;
  onBack?: () => void;
  backLabel?: string;
  /** When true, skip internal back link (parent sticky bar handles it). */
  embeddedInSheet?: boolean;
  onEdit?: (wine: Wine) => void;
  onRemove?: (wine: Wine) => void;
  onOpened?: (wine: Wine) => void;
  onSaveKimiResearch?: (wine: Wine, research: KimiResearch) => number | void;
  /** Persist owner dispute note (feedback only, not truth). */
  onSaveKimiUserNote?: (wine: Wine, note: string | null) => number | void;
  onApplyKimiResearch?: (
    wine: Wine,
    fields: { vivino?: boolean; price?: boolean }
  ) => number | void;
  /** Persist price-only verify result (no story/rating refresh). */
  onSaveVerifiedPrice?: (
    wine: Wine,
    result: { amount: number; currency: string }
  ) => number | void;
  onMove?: (wine: Wine) => void;
};

export function WineDetail({
  wine,
  onBack,
  backLabel = "",
  embeddedInSheet = false,
  onEdit,
  onRemove,
  onOpened,
  onSaveKimiResearch,
  onSaveKimiUserNote,
  onApplyKimiResearch,
  onSaveVerifiedPrice,
  onMove,
}: Props) {
  const t = useT();
  const { dict, locale } = useLocale();
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [kimiLoading, setKimiLoading] = useState(false);
  const [kimiError, setKimiError] = useState("");
  const [researchJustDone, setResearchJustDone] = useState(false);
  const [thinStoryHint, setThinStoryHint] = useState(false);
  const [applyHint, setApplyHint] = useState<string | null>(null);
  const [priceVerifyLoading, setPriceVerifyLoading] = useState(false);
  const [priceVerifyError, setPriceVerifyError] = useState("");
  const [labelSrc, setLabelSrc] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const researchAbortRef = useRef<AbortController | null>(null);
  const priceVerifyAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setShareHint(null);
    setKimiLoading(false);
    setKimiError("");
    setResearchJustDone(false);
    setThinStoryHint(false);
    setApplyHint(null);
    setPriceVerifyLoading(false);
    setPriceVerifyError("");
    setLabelSrc(null);
    setCorrectionOpen(false);
    setCorrectionDraft(wine?.kimiUserNote ?? "");
    setCorrectionError("");
    researchAbortRef.current?.abort();
    researchAbortRef.current = null;
    priceVerifyAbortRef.current?.abort();
    priceVerifyAbortRef.current = null;
  }, [wine?.id]);

  useEffect(() => {
    let cancelled = false;
    const path = wine?.labelImageUrl;
    if (!path) {
      setLabelSrc(null);
      return;
    }
    void resolveLabelImageUrl(path).then((url) => {
      if (!cancelled) setLabelSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [wine?.labelImageUrl]);

  const resolvedBackLabel = backLabel || t("common.back");

  if (!wine) {
    return (
      <div>
        {onBack && !embeddedInSheet ? (
          <button
            type="button"
            className="mobile-only mb-3 inline-flex min-h-[44px] items-center rounded-[10px] px-1 text-sm font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            onClick={onBack}
          >
            ← {resolvedBackLabel}
          </button>
        ) : null}
        <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-ink-soft sm:min-h-[280px]">
          {t("wine.selectFromMap")}
        </div>
      </div>
    );
  }

  const classified = parseGrapes(wine.grape);
  const pairing = resolvePairingsForWine(wine, clientCountryCodeHint());

  const facts: { label: string; value: ReactNode }[] = [
    {
      label: t("wine.country"),
      value: <CountryFlag country={wine.country} size="sm" showLabel />,
    },
    { label: t("wine.region"), value: wine.region || "—" },
    { label: t("wine.type"), value: wine.type ? wineTypeLabel(dict, wine.type) : "—" },
    { label: t("wine.winery"), value: wine.winery || "—" },
    {
      label: t("wine.grape"),
      value: wine.grape
        ? classified.length > 0
          ? classified.join(" · ")
          : wine.grape
        : "—",
    },
    { label: t("wine.year"), value: wine.vintage ? String(wine.vintage) : "—" },
    { label: t("wine.aging"), value: wine.aging || "—" },
    {
      label: t("wine.location"),
      value:
        wine.slot === "abajo"
          ? t("wine.belowOut")
          : wine.slot
            ? t("wine.slotLabel", { slot: wine.slot })
            : t("wine.noLocation"),
    },
  ];

  function applyKimiToFicha(fields: { price?: boolean }) {
    if (!wine || !onApplyKimiResearch) return;

    const parts: string[] = [];
    if (fields.price && wine.kimiPrice != null) {
      const fmt = formatPrice(wine.kimiPrice, wine.kimiPriceCurrency);
      parts.push(
        wine.price === wine.kimiPrice &&
          resolvePriceCurrency(wine.priceCurrency) ===
            resolvePriceCurrency(wine.kimiPriceCurrency)
          ? t("wine.priceAlreadyWas", { price: fmt })
          : t("wine.priceUpdatedTo", { price: fmt })
      );
    }
    if (!parts.length) {
      setApplyHint("No hay valores de la IA para aplicar.");
      return;
    }

    const applied = onApplyKimiResearch(wine, fields);
    const n = typeof applied === "number" ? applied : 1;
    const twin =
      n > 1 ? ` · ${n} botellas iguales` : "";
    setApplyHint(`Guardado en tu ficha${twin} · ${parts.join(" · ")}`);
    window.setTimeout(() => setApplyHint(null), 5000);
  }

  async function handleVerifyPrice() {
    if (!wine || !onSaveVerifiedPrice || priceVerifyLoading || kimiLoading) {
      return;
    }
    priceVerifyAbortRef.current?.abort();
    const abort = new AbortController();
    priceVerifyAbortRef.current = abort;
    const timeoutId = window.setTimeout(() => abort.abort(), 55_000);
    const countryCode = clientCountryCodeHint();

    setPriceVerifyLoading(true);
    setPriceVerifyError("");
    try {
      const res = await fetch("/api/verify-wine-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wine.name,
          winery: wine.winery,
          country: wine.country,
          region: wine.region,
          type: wine.type,
          grape: wine.grape,
          vintage: wine.vintage,
          ...(countryCode ? { countryCode } : {}),
        }),
        signal: abort.signal,
      });
      const raw = await res.text();
      let payload: {
        error?: string;
        amount?: number | null;
        currency?: string | null;
        source?: string | null;
        notes?: string | null;
      } = {};
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(t("wine.priceVerifyFailed"));
      }
      if (!res.ok || payload.amount == null || !payload.currency) {
        if (res.status === 429) {
          throw new Error("Demasiadas consultas. Espera un momento y reintenta.");
        }
        throw new Error(payload.error || t("wine.priceVerifyFailed"));
      }
      const currency = payload.currency.toUpperCase();
      onSaveVerifiedPrice(wine, {
        amount: Math.round(payload.amount),
        currency,
      });
      const sourceLabel =
        payload.source === "international"
          ? t("wine.priceSourceIntl")
          : payload.source === "local"
            ? t("wine.priceSourceLocal")
            : null;
      setApplyHint(
        `${formatPrice(payload.amount, currency)}${
          sourceLabel ? ` · ${sourceLabel}` : ""
        }`
      );
      window.setTimeout(() => setApplyHint(null), 5000);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setPriceVerifyError(
          "La consulta se canceló o tardó demasiado. Puedes reintentar."
        );
      } else if (e instanceof TypeError) {
        setPriceVerifyError("Sin conexión. Revisa internet e intenta de nuevo.");
      } else {
        const msg =
          e instanceof Error ? e.message : t("wine.priceVerifyFailed");
        setPriceVerifyError(
          msg === "Failed to fetch" ? t("wine.priceVerifyFailed") : msg
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (priceVerifyAbortRef.current === abort) {
        priceVerifyAbortRef.current = null;
      }
      setPriceVerifyLoading(false);
    }
  }

  async function handleShare() {
    if (!wine) return;
    const text = buildWineShareText(wine);
    const result = await shareOrCopyText(text, wine.name);
    if (result === "copied") {
      setShareHint(t("common.copied"));
      window.setTimeout(() => setShareHint(null), 2000);
    }
  }

  async function handleKimiResearch(opts?: { userCorrection?: string }) {
    if (!wine || !onSaveKimiResearch || kimiLoading) return;
    researchAbortRef.current?.abort();
    const abort = new AbortController();
    researchAbortRef.current = abort;
    const timeoutId = window.setTimeout(() => abort.abort(), 55_000);

    const correctionFromSubmit = opts?.userCorrection?.trim()
      ? opts.userCorrection.trim()
      : null;
    // Re-research may reuse last dispute note as contested claim (never truth).
    const storedNote = wine.kimiUserNote?.trim() || null;
    const userCorrection = correctionFromSubmit || storedNote || undefined;
    const countryCode = clientCountryCodeHint();

    setKimiLoading(true);
    setKimiError("");
    setResearchJustDone(false);
    setThinStoryHint(false);
    try {
      const res = await fetch("/api/research-wine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wine.name,
          winery: wine.winery,
          country: wine.country,
          region: wine.region,
          type: wine.type,
          grape: wine.grape,
          aging: wine.aging,
          vintage: wine.vintage,
          cavataleRating: wine.cavataleRating,
          cavataleEvidence: wine.cavataleEvidence,
          price: wine.price,
          ...(userCorrection ? { userCorrection } : {}),
          locale,
          ...(countryCode ? { countryCode } : {}),
        }),
        signal: abort.signal,
      });
      const raw = await res.text();
      let payload: {
        error?: string;
        research?: KimiResearch;
        thinStory?: boolean;
      } = {};
      try {
        payload = JSON.parse(raw) as {
          error?: string;
          research?: KimiResearch;
          thinStory?: boolean;
        };
      } catch {
        throw new Error(
          res.status === 504 || res.status === 408
            ? "La historia tardó demasiado. Reintenta en un momento."
            : res.ok
              ? "La IA respondió en un formato inesperado. Reintenta."
              : "El servidor falló al contar la historia. Reintenta."
        );
      }
      if (!res.ok || !payload.research) {
        if (res.status === 429) {
          throw new Error("Demasiadas consultas. Espera un momento y reintenta.");
        }
        throw new Error(payload.error || "No se pudo investigar este vino.");
      }
      const research = payload.research;
      const prevRating = wine.cavataleRating;
      const applied = onSaveKimiResearch(wine, research);
      if (correctionFromSubmit && onSaveKimiUserNote) {
        onSaveKimiUserNote(wine, correctionFromSubmit);
      }
      const n = typeof applied === "number" ? applied : 1;
      setResearchJustDone(true);
      const thin =
        payload.thinStory === true || isThinKimiStory(research);
      setThinStoryHint(thin);
      let hint =
        n > 1
          ? t("wine.storyApplied", { count: n })
          : t("wine.storyReady");
      const nextRating = research.cavataleRating;
      if (
        prevRating != null &&
        nextRating != null &&
        Math.round(prevRating * 10) !== Math.round(nextRating * 10)
      ) {
        hint = `${hint} · ${t("wine.ratingUpdated", {
          from: formatCavataleRating(prevRating),
          to: formatCavataleRating(nextRating),
        })}`;
      }
      setShareHint(hint);
      window.setTimeout(() => setShareHint(null), 3500);
      if (correctionFromSubmit) {
        setCorrectionOpen(false);
        setCorrectionError("");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setKimiError(
          "La consulta se canceló o tardó demasiado. Puedes reintentar."
        );
      } else if (e instanceof TypeError) {
        setKimiError("Sin conexión. Revisa internet e intenta de nuevo.");
      } else {
        const msg =
          e instanceof Error ? e.message : "Error al consultar la IA.";
        setKimiError(
          msg === "Failed to fetch"
            ? "No hubo respuesta a tiempo. Revisa la conexión e intenta de nuevo."
            : msg
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (researchAbortRef.current === abort) researchAbortRef.current = null;
      setKimiLoading(false);
    }
  }

  function handleSubmitCorrection() {
    const checked = normalizeUserCorrectionNote(correctionDraft);
    if (!checked.ok) {
      setCorrectionError(checked.error);
      return;
    }
    setCorrectionError("");
    void handleKimiResearch({ userCorrection: checked.note });
  }

  const priceNeedsApply =
    wine.kimiPrice != null &&
    (wine.price !== wine.kimiPrice ||
      resolvePriceCurrency(wine.priceCurrency) !==
        resolvePriceCurrency(wine.kimiPriceCurrency));
  const hasRefEstimates = wine.kimiPrice != null;
  const refsAllMatch = hasRefEstimates && !priceNeedsApply;
  const hasKimi =
    wine.kimiCheckedAt != null ||
    wine.cavataleRating != null ||
    wine.kimiPrice != null ||
    Boolean(wine.kimiSummary) ||
    Boolean(wine.kimiCuriosity) ||
    Boolean(wine.kimiTalkHook);
  const showPriceReference = hasKimi;
  const hasDiscoveryStory =
    Boolean(wine.kimiSummary) ||
    Boolean(wine.kimiCuriosity) ||
    Boolean(wine.kimiTalkHook);

  return (
    <div className="min-w-0 overflow-hidden">
      {onBack && !embeddedInSheet ? (
        <button
          type="button"
          className="mobile-only mb-3 inline-flex min-h-[44px] items-center rounded-[10px] px-1 text-sm font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          onClick={onBack}
        >
          ← {resolvedBackLabel}
        </button>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="micro-label text-ink-soft">{t("wine.detail")}</p>
          <h2 className="display mt-2 text-[1.85rem] leading-tight text-ink sm:text-3xl">
            {wine.name}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {wine.winery || t("wine.noWinery")} · {wine.vintage ?? t("wine.naVintage")}
          </p>
        </div>
        <CountryFlag country={wine.country} size="lg" />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 sm:mt-5">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: typeAccent(wine.type) }}
          />
          {wineTypeLabel(dict, wine.type)}
        </span>
        {wine.cavataleRating != null ? (
          <span className="display text-2xl leading-none text-ink sm:text-[1.75rem]">
            {formatCavataleRating(wine.cavataleRating)}
            <span className="ml-1.5 align-middle font-sans text-[11px] font-normal uppercase tracking-[0.14em] text-ink-soft">
              {t("wine.rating")}
            </span>
          </span>
        ) : null}
        {wine.price != null ? (
          <span className="text-xs text-ink-soft">
            {formatPrice(wine.price, wine.priceCurrency)}
          </span>
        ) : null}
        <DrinkWindowBadge wine={wine} size="md" />
      </div>
      {(() => {
        const win = computeDrinkWindow(wine);
        if (!win) return null;
        return (
          <p className="mt-1.5 text-xs text-ink-soft">
            {t("drinkWindow.range", {
              from: win.drinkFrom,
              peak: win.drinkPeak,
              by: win.drinkBy,
            })}
          </p>
        );
      })()}

      {onSaveKimiResearch ? (
        <div
          className="discovery-stage mt-5 sm:mt-6"
          aria-busy={kimiLoading || undefined}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="micro-label text-[var(--wine)]">{t("wine.discovery")}</p>
              {hasDiscoveryStory ? (
                <p className="mt-1 text-xs text-ink-soft">
                  {t("wine.lastQuery", {
                    date: formatCheckedAt(wine.kimiCheckedAt),
                  })}
                  {wine.kimiConfidence
                    ? ` · ${confidenceLabel[wine.kimiConfidence]}`
                    : ""}
                </p>
              ) : (
                <h3 className="display mt-1.5 text-[1.65rem] leading-tight text-ink sm:text-2xl">
                  {t("wine.whatStory")}
                </h3>
              )}
            </div>
            {hasDiscoveryStory ? (
              <button
                type="button"
                className="btn btn-ghost min-h-[40px] shrink-0 px-3 text-sm disabled:opacity-60"
                disabled={kimiLoading}
                aria-busy={kimiLoading}
                onClick={() => void handleKimiResearch()}
              >
                {kimiLoading ? (
                  <ThinkingIndicator tone="wine" size="sm" label={t("wine.telling")} />
                ) : (
                  t("common.refresh")
                )}
              </button>
            ) : null}
          </div>

          {kimiError ? (
            <div className="mt-2 space-y-2" role="alert">
              <p className="text-sm text-[var(--wine)]">{kimiError}</p>
              <button
                type="button"
                className="btn btn-ghost min-h-[40px] px-3 text-sm disabled:opacity-60"
                disabled={kimiLoading}
                onClick={() => void handleKimiResearch()}
              >
                {t("common.retry")}
              </button>
            </div>
          ) : null}

          <AiTheaterStatus active={kimiLoading} className="mt-2" />

          {researchJustDone && !kimiLoading && !kimiError ? (
            <p className="mt-2 text-sm text-[var(--wine-deep)]" role="status">
              {t("wine.storyReady")}
            </p>
          ) : null}

          {!hasDiscoveryStory && !kimiLoading ? (
            <div className="mt-3">
              <p className="max-w-md text-sm leading-relaxed text-ink-soft">
                Historia, dato curioso, gancho de mesa y calificación Cavatale — lo
                que hace distinta a esta botella.
              </p>
              <button
                type="button"
                className="btn btn-primary mt-4 min-h-[48px] w-full text-base disabled:opacity-60"
                disabled={kimiLoading}
                onClick={() => void handleKimiResearch()}
              >
                {t("wine.tellWineStory")}
              </button>
            </div>
          ) : null}

          {hasDiscoveryStory ? (
            <div className="mt-4 space-y-4">
              {wine.kimiTalkHook ? (
                <div className="tale-hook">
                  <p className="tale-hook-label text-[11px] uppercase tracking-[0.16em]">
                    {t("wine.talkHook")}
                  </p>
                  <p className="display mt-2 text-[1.3rem] leading-snug sm:text-[1.45rem]">
                    {wine.kimiTalkHook}
                  </p>
                </div>
              ) : null}
              {wine.kimiSummary ? (
                <div className="reveal-in-delay">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    {t("wine.story")}
                  </p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink sm:text-base">
                    {wine.kimiSummary}
                  </p>
                </div>
              ) : null}
              {wine.kimiCuriosity ? (
                <div className="reveal-in-delay">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    {t("wine.curiosity")}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">
                    {wine.kimiCuriosity}
                  </p>
                </div>
              ) : null}
              {thinStoryHint && researchJustDone && !kimiLoading ? (
                <p className="text-xs leading-relaxed text-ink-soft">
                  Si suena a ficha de tienda,{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-ink"
                    disabled={kimiLoading}
                    onClick={() => void handleKimiResearch()}
                  >
                    {t("common.refresh")}
                  </button>{" "}
                  suele dar otra versión.
                </p>
              ) : null}

              {!kimiLoading ? (
                <div className="pt-1">
                  {!correctionOpen ? (
                    <button
                      type="button"
                      className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                      disabled={kimiLoading}
                      onClick={() => {
                        setCorrectionOpen(true);
                        setCorrectionError("");
                        if (!correctionDraft && wine.kimiUserNote) {
                          setCorrectionDraft(wine.kimiUserNote);
                        }
                      }}
                    >
                      {t("wine.somethingWrong")}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        {t("wine.reportError")}
                      </p>
                      <p className="text-xs leading-relaxed text-ink-soft">
                        Señala qué está mal (dato concreto). No inventamos
                        biografías a pedido. La IA contrastará tu nota; no la
                        tomará como verdad automática.
                      </p>
                      <label className="sr-only" htmlFor="kimi-correction-note">
                        {t("wine.correctionAria")}
                      </label>
                      <textarea
                        id="kimi-correction-note"
                        rows={3}
                        maxLength={500}
                        value={correctionDraft}
                        disabled={kimiLoading}
                        placeholder={t("wine.correctionPlaceholder")}
                        className="w-full resize-y rounded-[10px] border border-[rgba(110,31,44,0.22)] bg-[rgba(255,252,247,0.8)] px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-[rgba(110,31,44,0.45)] focus:outline-none"
                        onChange={(e) => {
                          setCorrectionDraft(e.target.value);
                          if (correctionError) setCorrectionError("");
                        }}
                      />
                      {correctionError ? (
                        <p className="text-xs text-[var(--wine)]" role="alert">
                          {correctionError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost min-h-[40px] px-3 text-sm disabled:opacity-60"
                          disabled={kimiLoading}
                          onClick={() => handleSubmitCorrection()}
                        >
                          {t("wine.requestReview")}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-ink-soft underline-offset-2 hover:underline"
                          disabled={kimiLoading}
                          onClick={() => {
                            setCorrectionOpen(false);
                            setCorrectionError("");
                          }}
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <button
                type="button"
                className="btn btn-primary min-h-[48px] w-full text-base"
                onClick={() => void handleShare()}
              >
                {shareHint ?? t("wine.shareStory")}
              </button>
            </div>
          ) : null}

          {hasKimi && wine.cavataleRating != null ? (
            <div className="mt-4">
              <CavataleRatingCard
                rating={wine.cavataleRating}
                parts={wine.cavataleParts}
                evidence={wine.cavataleEvidence}
              />
            </div>
          ) : null}

          {showPriceReference ? (
            <div className="mt-4 space-y-3 border-t border-[rgba(110,31,44,0.14)] pt-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {t("wine.priceReference")}
              </p>
              {refsAllMatch ? (
                <p className="text-sm text-ink-soft">
                  {t("wine.priceMatchesFicha")}
                  {wine.kimiPrice != null
                    ? ` · ${formatPrice(wine.kimiPrice, wine.kimiPriceCurrency)}`
                    : ""}
                  .
                </p>
              ) : wine.kimiPrice != null ? (
                <>
                  {priceNeedsApply ? (
                    <>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        {t("wine.estimatedPrice")}
                      </p>
                      <p className="mt-1 text-sm text-ink">
                        {formatPrice(wine.kimiPrice, wine.kimiPriceCurrency)}
                        <span className="text-ink-soft">
                          {wine.price == null
                            ? t("wine.noPriceOnFicha")
                            : t("wine.yourPrice", {
                                price: formatPrice(
                                  wine.price,
                                  wine.priceCurrency
                                ),
                              })}
                        </span>
                      </p>
                      {onApplyKimiResearch ? (
                        <button
                          type="button"
                          className="mt-2 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                          onClick={() => applyKimiToFicha({ price: true })}
                        >
                          {t("wine.useThisPrice")}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-ink-soft">
                      {t("wine.priceOnFicha", {
                        price: formatPrice(wine.price, wine.priceCurrency),
                      })}
                    </p>
                  )}
                  {onApplyKimiResearch && priceNeedsApply ? (
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[44px] w-full text-sm"
                      onClick={() => applyKimiToFicha({ price: true })}
                    >
                      {t("wine.applyPriceToFicha")}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-ink-soft">
                  {wine.price != null
                    ? formatPrice(wine.price, wine.priceCurrency)
                    : "—"}
                </p>
              )}
              {onSaveVerifiedPrice ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] w-full text-sm"
                  disabled={priceVerifyLoading || kimiLoading}
                  onClick={() => void handleVerifyPrice()}
                >
                  {priceVerifyLoading
                    ? t("wine.verifyingPrice")
                    : t("wine.verifyPrice")}
                </button>
              ) : null}
              {priceVerifyError ? (
                <p className="text-sm text-[var(--wine-deep)]" role="alert">
                  {priceVerifyError}
                </p>
              ) : null}
              {applyHint ? (
                <p className="text-sm text-[var(--wine-deep)]" role="status">
                  {applyHint}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {labelSrc ? (
        <div className="mt-5 overflow-hidden rounded-[12px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={labelSrc}
            alt={t("wine.labelAlt", { name: wine.name })}
            className="max-h-72 w-full object-contain bg-[rgba(20,18,16,0.04)]"
          />
        </div>
      ) : null}

      <dl className="mt-5 space-y-3 border-t border-[var(--line)] pt-4 sm:mt-6 sm:pt-5">
        {facts.map((f) => (
          <div
            key={f.label}
            className="grid grid-cols-[88px_1fr] gap-2 text-sm sm:grid-cols-[110px_1fr] sm:gap-3"
          >
            <dt className="text-ink-soft">{f.label}</dt>
            <dd className="break-words text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <p className="micro-label text-ink-soft">{t("wine.suggestedPairing")}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {pairing.source === "ia"
            ? `IA · ${pairing.note}`
            : pairing.note}
        </p>
        {pairing.source === "reglas" && onSaveKimiResearch && !hasKimi ? (
          <p className="mt-1 text-xs text-ink-soft">
            Genérico por uva/estilo. Al contar la historia, la IA lo afina
            para esta botella.
          </p>
        ) : null}
        <p className="mt-3 text-sm leading-relaxed text-ink">
          {pairing.dishes.join(" · ")}
        </p>
      </div>

      {(onOpened || onEdit || onRemove || onMove) && (
        <div className="mt-6 min-w-0 space-y-2 border-t border-[var(--line)] pt-4">
          {onOpened ? (
            <button
              type="button"
              className="btn btn-primary min-h-[44px] min-w-0 w-full px-3"
              onClick={() => onOpened(wine)}
            >
              {t("wine.opened")}
            </button>
          ) : null}
          {(onEdit || onRemove || onMove) && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {onMove ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] min-w-0 w-full px-3"
                  onClick={() => onMove(wine)}
                >
                  {t("wine.moveFurniture")}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] min-w-0 w-full px-3"
                onClick={() => void handleShare()}
              >
                {shareHint ?? t("common.share")}
              </button>
              {onEdit ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] min-w-0 w-full px-3"
                  onClick={() => onEdit(wine)}
                >
                  {t("common.edit")}
                </button>
              ) : null}
              {onRemove ? (
                <button
                  type="button"
                  className="btn min-h-[44px] min-w-0 w-full border border-[rgba(110,31,44,0.35)] bg-[rgba(110,31,44,0.08)] px-3 text-[var(--wine-deep)] sm:col-span-2"
                  onClick={() => {
                    if (
                      confirm(
                        t("wine.confirmRemoveNamed", { name: wine.name })
                      )
                    ) {
                      onRemove(wine);
                    }
                  }}
                >
                  {t("wine.remove")}
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-ink-soft sm:mt-8">
        {t("wine.cavataleFooter")}
      </p>
    </div>
  );
}
