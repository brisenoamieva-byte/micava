"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AiTheaterStatus } from "@/components/AiTheaterStatus";
import { CavataleRatingCard } from "@/components/CavataleRatingCard";
import { LabelPhotoCapture } from "@/components/LabelPhotoCapture";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import {
  assessKimiStoryQuality,
  emptyKimiResearch,
  type KimiResearch,
} from "@/lib/kimi-research";
import {
  fetchEnrichLabel,
  fetchScanLabel,
  mergeScanPatchIntoDraft,
  scanFieldsToDraftPatch,
} from "@/lib/scan-label";
import type { Encounter, EncounterDraft, WineDraft } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { clientCountryCodeHint } from "@/lib/market-geo";
import { countryDisplayName } from "@/lib/wines";

type Step = "identify" | "story";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (entry: Omit<Encounter, "id" | "at">) => void;
  /** After bitácora save, optionally open Agregar with this identity. */
  onAlsoAddToCava?: (draft: WineDraft) => void;
};

const fieldClass =
  "w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.95)] px-3 py-2.5 outline-none focus:border-[rgba(122,36,48,0.45)]";

const emptyIdentity = (): EncounterDraft => ({
  name: "",
  winery: "",
  country: "México",
  region: "",
  type: "Tinto",
  grape: "",
  aging: "",
  vintage: null,
});

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toWineDraft(identity: EncounterDraft): WineDraft {
  return {
    name: identity.name,
    winery: identity.winery,
    country: identity.country,
    region: identity.region,
    type: identity.type,
    grape: identity.grape,
    aging: identity.aging,
    vintage: identity.vintage,
    vivino: null,
    price: null,
    cellarId: null,
    location: "",
  };
}

export function EncuentroModal({
  open,
  onClose,
  onSave,
  onAlsoAddToCava,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [step, setStep] = useState<Step>("identify");
  const [identity, setIdentity] = useState<EncounterDraft>(emptyIdentity);
  const [research, setResearch] = useState<KimiResearch>(emptyKimiResearch);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [scanHint, setScanHint] = useState("");
  const [error, setError] = useState("");
  const [kimiLoading, setKimiLoading] = useState(false);
  const [thinHint, setThinHint] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanImages, setScanImages] = useState<string[]>([]);
  const scanAbortRef = useRef<AbortController | null>(null);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const researchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("identify");
    setIdentity(emptyIdentity());
    setResearch(emptyKimiResearch);
    setScanning(false);
    setEnriching(false);
    setScanHint("");
    setError("");
    setKimiLoading(false);
    setThinHint(false);
    setSaved(false);
    setScanImages([]);
    scanAbortRef.current?.abort();
    enrichAbortRef.current?.abort();
    researchAbortRef.current?.abort();
  }, [open]);

  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort();
      enrichAbortRef.current?.abort();
      researchAbortRef.current?.abort();
    };
  }, []);

  if (!open) return null;

  async function handleScanImages(urls: string[]) {
    if (!urls.length || scanning) return;
    setScanning(true);
    setEnriching(false);
    setError("");
    setScanHint("");
    scanAbortRef.current?.abort();
    enrichAbortRef.current?.abort();
    const abort = new AbortController();
    scanAbortRef.current = abort;
    const timeoutId = window.setTimeout(() => abort.abort(), 45_000);

    try {
      const { status, payload } = await fetchScanLabel(urls, abort.signal);

      if ((status === 200 || status === 422) && payload.fields) {
        const patch = scanFieldsToDraftPatch(payload.fields);
        const merged = mergeScanPatchIntoDraft(toWineDraft(identity), patch);
        setIdentity({
          name: merged.name,
          winery: merged.winery,
          country: merged.country,
          region: merged.region,
          type: merged.type,
          grape: merged.grape,
          aging: merged.aging,
          vintage: merged.vintage,
        });
        setScanHint(
          status === 422
            ? t("scan.lowConfidenceReview")
            : payload.fields.confidence === "high"
              ? payload.needsEnrich
                ? t("scan.highConfidenceEnrich")
                : t("scan.highConfidenceContinue")
              : t("scan.reviewBeforeStory")
        );
        if (status === 422) {
          setError(
            payload.error || t("scan.couldNotIdentify")
          );
        }

        if (status === 200 && payload.needsEnrich && payload.fields.name) {
          const enrichAbort = new AbortController();
          enrichAbortRef.current = enrichAbort;
          setEnriching(true);
          const enrichTimeout = window.setTimeout(
            () => enrichAbort.abort(),
            35_000
          );
          const baseFields = payload.fields;
          void (async () => {
            try {
              const enriched = await fetchEnrichLabel(
                baseFields,
                payload.enrichHint,
                enrichAbort.signal
              );
              if (!enriched || enrichAbort.signal.aborted) return;
              const enrichPatch = scanFieldsToDraftPatch(enriched);
              setIdentity((prev) => {
                const next = mergeScanPatchIntoDraft(
                  toWineDraft(prev),
                  enrichPatch
                );
                return {
                  name: next.name,
                  winery: next.winery,
                  country: next.country,
                  region: next.region,
                  type: next.type,
                  grape: next.grape,
                  aging: next.aging,
                  vintage: next.vintage,
                };
              });
              setScanHint(
                enriched.confidence === "high"
                  ? t("scan.highConfidenceContinue")
                  : t("scan.reviewBeforeStory")
              );
            } catch {
              /* keep vision identity */
            } finally {
              window.clearTimeout(enrichTimeout);
              if (enrichAbortRef.current === enrichAbort) {
                enrichAbortRef.current = null;
              }
              setEnriching(false);
            }
          })();
        }
        return;
      }

      if (status !== 200 || !payload.fields) {
        throw new Error(payload.error || t("scan.failed"));
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError(t("scan.scanAborted"));
      } else if (e instanceof TypeError) {
        setError(t("scan.scanNoConnection"));
      } else {
        setError(e instanceof Error ? e.message : t("scan.scanError"));
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (scanAbortRef.current === abort) scanAbortRef.current = null;
      setScanning(false);
    }
  }

  function goToStory(e?: FormEvent) {
    e?.preventDefault();
    if (!identity.name.trim()) {
      setError(t("wine.nameRequired"));
      return;
    }
    setError("");
    setThinHint(false);
    setResearch(emptyKimiResearch);
    setStep("story");
    // Start research immediately — no second "Contar historia" click.
    void handleResearch();
  }

  async function handleResearch() {
    if (kimiLoading || !identity.name.trim()) return;
    researchAbortRef.current?.abort();
    const abort = new AbortController();
    researchAbortRef.current = abort;
    const timeoutId = window.setTimeout(() => abort.abort(), 55_000);

    setKimiLoading(true);
    setError("");
    setThinHint(false);
    try {
      const countryCode = clientCountryCodeHint();
      const res = await fetch("/api/research-wine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "encounter",
          name: identity.name.trim(),
          winery: identity.winery.trim(),
          country: identity.country.trim(),
          region: identity.region.trim(),
          type: identity.type.trim(),
          grape: identity.grape.trim(),
          aging: identity.aging.trim(),
          vintage: identity.vintage,
          vivino: research.kimiVivino,
          kimiVivino: research.kimiVivino,
          cavataleRating: research.cavataleRating,
          cavataleEvidence: research.cavataleEvidence,
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
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(t("scan.unexpectedFormat"));
      }
      if (!res.ok || !payload.research) {
        if (res.status === 429) {
          throw new Error(t("scan.tooManyRequests"));
        }
        throw new Error(payload.error || t("scan.couldNotTellStory"));
      }
      setResearch(payload.research);
      const quality = assessKimiStoryQuality(payload.research);
      setThinHint(Boolean(payload.thinStory) || quality.thin);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError(t("scan.researchAborted"));
      } else if (e instanceof TypeError) {
        setError(t("scan.researchNoConnection"));
      } else {
        setError(e instanceof Error ? e.message : t("scan.researchError"));
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (researchAbortRef.current === abort) researchAbortRef.current = null;
      setKimiLoading(false);
    }
  }

  const hasStory = Boolean(
    research.kimiSummary || research.kimiCuriosity || research.kimiTalkHook
  );

  function handleSave(alsoAdd: boolean) {
    if (saved) return;
    if (!hasStory) {
      setError(t("scan.tellStoryFirst"));
      return;
    }
    onSave({
      wineId: null,
      name: identity.name.trim(),
      winery: identity.winery.trim(),
      country: identity.country.trim(),
      region: identity.region.trim(),
      type: identity.type.trim() || "Tinto",
      grape: identity.grape.trim(),
      aging: identity.aging.trim(),
      vintage: identity.vintage,
      cavataleRating: research.cavataleRating,
      cavataleParts: research.cavataleParts,
      cavataleEvidence: research.cavataleEvidence,
      kimiSummary: research.kimiSummary,
      kimiCuriosity: research.kimiCuriosity,
      kimiTalkHook: research.kimiTalkHook,
      kimiPairings: research.kimiPairings,
      kimiPairingNote: research.kimiPairingNote,
      kimiCheckedAt: research.kimiCheckedAt,
      kimiConfidence: research.kimiConfidence,
      place: null,
      note: null,
    });
    setSaved(true);
    if (alsoAdd && onAlsoAddToCava) {
      onAlsoAddToCava(toWineDraft(identity));
    } else {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,18,16,0.45)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="encuentro-title"
      onClick={onClose}
    >
      <div
        className="panel max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[18px] p-4 sm:rounded-[14px] sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--wine)]">
              {t("cava.scanBottle")}
            </p>
            <h2 id="encuentro-title" className="display mt-1 text-2xl text-ink">
              {step === "identify"
                ? t("scan.whatBottle")
                : t("scan.theStory")}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {step === "identify"
                ? t("scan.identifySubtitle")
                : t("scan.storySubtitle")}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost min-h-[40px] px-3 text-sm"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>

        {error ? (
          <p className="mb-3 text-sm text-[var(--wine)]" role="alert">
            {error}
          </p>
        ) : null}

        {step === "identify" ? (
          <form className="space-y-3" onSubmit={goToStory}>
            <LabelPhotoCapture
              images={scanImages}
              onImagesChange={setScanImages}
              scanning={scanning}
              onIdentify={(urls) => void handleScanImages(urls)}
            />
            {scanHint ? (
              <p className="text-xs text-ink-soft">
                {enriching && !scanHint.includes(t("scan.confirmingShort").slice(0, 8))
                  ? `${scanHint} · ${t("scan.confirmingShort")}`
                  : scanHint}
              </p>
            ) : enriching ? (
              <p className="text-xs text-ink-soft">{t("scan.confirmingMarket")}</p>
            ) : null}

            <p className="text-center text-xs text-ink-soft">{t("scan.orWriteName")}</p>

            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {t("wine.name")} *
              </span>
              <input
                className={fieldClass}
                value={identity.name}
                onChange={(e) =>
                  setIdentity((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={t("scan.namePlaceholder")}
                required
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {t("wine.winery")}
              </span>
              <input
                className={fieldClass}
                value={identity.winery}
                onChange={(e) =>
                  setIdentity((prev) => ({ ...prev, winery: e.target.value }))
                }
                placeholder={t("common.optional")}
                autoComplete="off"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.country")}
                </span>
                <input
                  className={fieldClass}
                  value={identity.country}
                  onChange={(e) =>
                    setIdentity((prev) => ({
                      ...prev,
                      country: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.year")}
                </span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={identity.vintage ?? ""}
                  onChange={(e) =>
                    setIdentity((prev) => ({
                      ...prev,
                      vintage: parseOptionalNumber(e.target.value),
                    }))
                  }
                  placeholder="—"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.type")}
                </span>
                <input
                  className={fieldClass}
                  value={identity.type}
                  onChange={(e) =>
                    setIdentity((prev) => ({ ...prev, type: e.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.region")}
                </span>
                <input
                  className={fieldClass}
                  value={identity.region}
                  onChange={(e) =>
                    setIdentity((prev) => ({ ...prev, region: e.target.value }))
                  }
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {t("wine.grape")}
              </span>
              <input
                className={fieldClass}
                value={identity.grape}
                onChange={(e) =>
                  setIdentity((prev) => ({ ...prev, grape: e.target.value }))
                }
                placeholder={t("common.optional")}
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary min-h-[48px] w-full text-base disabled:opacity-60"
              disabled={kimiLoading}
            >
              {t("wine.tellStory")}
            </button>
          </form>
        ) : null}

        {step === "story" ? (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] px-3 py-2.5">
              <p className="font-medium text-ink">{identity.name}</p>
              <p className="text-xs text-ink-soft">
                {[
                  identity.winery,
                  identity.vintage,
                  countryDisplayName(identity.country, locale),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <button
                type="button"
                className="mt-1 text-xs text-ink-soft underline-offset-2 hover:underline"
                onClick={() => setStep("identify")}
              >
                {t("scan.fixIdentity")}
              </button>
            </div>

            <div className={hasStory ? "discovery-stage" : undefined}>
              {!hasStory && !kimiLoading ? (
                <div>
                  <h3 className="display text-[1.65rem] leading-tight text-ink">
                    {t("wine.whatStory")}
                  </h3>
                  <button
                    type="button"
                    className="btn btn-primary mt-4 min-h-[48px] w-full text-base disabled:opacity-60"
                    disabled={kimiLoading}
                    onClick={() => void handleResearch()}
                  >
                    {t("wine.tellWineStory")}
                  </button>
                </div>
              ) : null}

              <AiTheaterStatus active={kimiLoading} className="mt-2" />

              {hasStory ? (
                <div className="mt-2 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--wine)]">
                      {t("scan.thisBottle")}
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[40px] shrink-0 px-3 text-sm disabled:opacity-60"
                      disabled={kimiLoading}
                      onClick={() => void handleResearch()}
                    >
                      {kimiLoading ? (
                        <ThinkingIndicator
                          tone="wine"
                          size="sm"
                          label={t("wine.telling")}
                        />
                      ) : (
                        t("common.refresh")
                      )}
                    </button>
                  </div>
                  {research.kimiTalkHook ? (
                    <div className="tale-hook">
                      <p className="tale-hook-label text-[11px] uppercase tracking-[0.16em]">
                        {t("wine.talkHook")}
                      </p>
                      <p className="display mt-2 text-[1.4rem] leading-snug sm:text-[1.55rem]">
                        {research.kimiTalkHook}
                      </p>
                    </div>
                  ) : null}
                  {research.kimiSummary ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        {t("wine.story")}
                      </p>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
                        {research.kimiSummary}
                      </p>
                    </div>
                  ) : null}
                  {research.kimiCuriosity ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        {t("wine.curiosity")}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink">
                        {research.kimiCuriosity}
                      </p>
                    </div>
                  ) : null}
                  {thinHint ? (
                    <p className="text-xs text-ink-soft">
                      {t("scan.thinStoryHint")}
                    </p>
                  ) : null}
                  {research.cavataleRating != null ? (
                    <CavataleRatingCard
                      rating={research.cavataleRating}
                      parts={research.cavataleParts}
                      evidence={research.cavataleEvidence}
                      rubric={t("scan.cavataleRubric")}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary min-h-[48px] w-full text-base disabled:opacity-60"
                    disabled={saved}
                    onClick={() => handleSave(false)}
                  >
                    {t("scan.saveToBitacora")}
                  </button>
                  {onAlsoAddToCava ? (
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[44px] w-full text-sm disabled:opacity-60"
                      disabled={saved}
                      onClick={() => handleSave(true)}
                    >
                      {t("scan.saveAndAdd")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
