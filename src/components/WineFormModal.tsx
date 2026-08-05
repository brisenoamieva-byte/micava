"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Wine, WineDraft } from "@/lib/types";
import {
  countryDisplayName,
  countryFlagEmoji,
  formatPrice,
  formatCavataleRating,
  getEmptySlots,
  getWineBySlot,
  parseLocation,
} from "@/lib/wines";
import { wineToDraft } from "@/lib/cellar-store";
import {
  fetchEnrichLabel,
  fetchScanLabel,
  imageFileToDataUrl,
  mergeScanPatchIntoDraft,
  missingScanFieldLabels,
  scanFieldsToDraftPatch,
  type ScanLabelFields,
} from "@/lib/scan-label";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { useLocale, useT, wineTypeLabel } from "@/lib/i18n";

type Props = {
  open: boolean;
  wines: Wine[];
  cellars: { id: string; name: string; cols: number; rows: string[] }[];
  activeCellarId: string | null;
  initialSlot?: string;
  /** When adding: start on chooser (default) or blank form. */
  initialStep?: "pick" | "form";
  /** Prefill identity (e.g. from Escanear botella → también sumar a cava). */
  prefillDraft?: WineDraft | null;
  editing?: Wine | null;
  onClose: () => void;
  onSubmit: (
    draft: WineDraft,
    extras?: { labelImageDataUrl?: string }
  ) => void;
};

const fieldClass =
  "w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.95)] px-3 py-2.5 outline-none focus:border-[rgba(122,36,48,0.45)]";

const emptyDraft = (slot = "", cellarId: string | null = null): WineDraft => ({
  name: "",
  winery: "",
  country: "México",
  region: "",
  type: "Tinto",
  grape: "",
  aging: "",
  vintage: null,
  vivino: null,
  price: null,
  cellarId,
  location: slot,
});

function wineKey(w: Pick<Wine, "name" | "winery" | "vintage">): string {
  return [w.name, w.winery, w.vintage ?? ""]
    .map((s) => String(s).trim().toLowerCase())
    .join("|");
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Unique wines already in the cellar (one row per name/winery/vintage). */
function buildCatalog(wines: Wine[]): Wine[] {
  const map = new Map<string, Wine>();
  for (const w of wines) {
    const key = wineKey(w);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, w);
      continue;
    }
    // Prefer the one with more complete data
    const score = (x: Wine) =>
      (x.cavataleRating != null ? 2 : 0) +
      (x.price != null ? 1 : 0) +
      (x.grape ? 1 : 0);
    if (score(w) > score(prev)) map.set(key, w);
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es") ||
    a.winery.localeCompare(b.winery, "es") ||
    (b.vintage ?? 0) - (a.vintage ?? 0)
  );
}

export function WineFormModal({
  open,
  wines,
  cellars,
  activeCellarId,
  initialSlot = "",
  initialStep = "pick",
  prefillDraft = null,
  editing = null,
  onClose,
  onSubmit,
}: Props) {
  const t = useT();
  const { dict, locale } = useLocale();
  const [draft, setDraft] = useState<WineDraft>(
    emptyDraft(initialSlot, activeCellarId)
  );
  const [error, setError] = useState("");
  /** When adding: pick from catalog first, or go straight to form. */
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [fromExisting, setFromExisting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [scanHint, setScanHint] = useState("");
  const [labelImageDataUrl, setLabelImageDataUrl] = useState<string | null>(
    null
  );
  const [lastScanFile, setLastScanFile] = useState<File | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanAbortRef = useRef<AbortController | null>(null);
  const enrichAbortRef = useRef<AbortController | null>(null);

  const catalog = useMemo(() => buildCatalog(wines), [wines]);

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((w) => {
      const blob = [w.name, w.winery, w.country, w.region, w.grape, w.vintage]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [catalog, catalogQuery]);

  const targetCellarId =
    draft.location === "abajo" || !draft.location
      ? null
      : draft.cellarId ?? activeCellarId;
  const targetCellar =
    cellars.find((c) => c.id === targetCellarId) ?? cellars[0] ?? null;

  const emptySlots = useMemo(() => {
    if (!targetCellar) return [];
    const free = getEmptySlots(
      wines,
      targetCellar.cols,
      targetCellar.rows,
      targetCellar.id
    );
    if (
      editing?.slot &&
      editing.slot !== "abajo" &&
      editing.cellarId === targetCellar.id &&
      !free.includes(editing.slot)
    ) {
      return [editing.slot, ...free];
    }
    return free;
  }, [wines, editing, targetCellar]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setCatalogQuery("");
    setFromExisting(false);
    setScanning(false);
    setEnriching(false);
    setScanHint("");
    setLabelImageDataUrl(null);
    setLastScanFile(null);
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
    enrichAbortRef.current?.abort();
    enrichAbortRef.current = null;
    if (editing) {
      setStep("form");
      setDraft(wineToDraft(editing));
    } else if (prefillDraft) {
      setStep("form");
      setFromExisting(true);
      setDraft({
        ...prefillDraft,
        cellarId: prefillDraft.cellarId ?? activeCellarId,
        location: prefillDraft.location || initialSlot || "",
      });
    } else {
      setDraft(emptyDraft(initialSlot, activeCellarId));
      // Always offer scan vs manual (and catalog when it exists).
      setStep(initialStep === "form" ? "form" : "pick");
    }
  }, [open, editing, prefillDraft, initialSlot, initialStep, activeCellarId]);

  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort();
      enrichAbortRef.current?.abort();
    };
  }, []);

  if (!open) return null;

  function patch<K extends keyof WineDraft>(key: K, value: WineDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyExisting(wine: Wine) {
    const next: WineDraft = {
      ...wineToDraft(wine),
      cellarId: activeCellarId,
      location: initialSlot || "",
    };
    // From a map cell: picking an existing wine adds a bottle there immediately.
    if (initialSlot) {
      onSubmit(next);
      onClose();
      return;
    }
    setDraft(next);
    setFromExisting(true);
    setStep("form");
    setError("");
  }

  function startBlank() {
    setDraft(emptyDraft(initialSlot, activeCellarId));
    setFromExisting(false);
    setStep("form");
    setError("");
    setScanHint("");
    setLabelImageDataUrl(null);
  }

  async function handleScanFile(file: File | undefined) {
    if (!file || scanning) return;
    setLastScanFile(file);
    setScanning(true);
    setEnriching(false);
    setError("");
    setScanHint("");
    scanAbortRef.current?.abort();
    enrichAbortRef.current?.abort();
    const abort = new AbortController();
    scanAbortRef.current = abort;
    // Vision-only should finish well under this; enrich runs separately.
    const timeoutId = window.setTimeout(() => abort.abort(), 35_000);

    function applyFieldsHint(
      fields: ScanLabelFields,
      proposedPrice: number | null,
      suffix?: string
    ) {
      const conf =
        fields.confidence === "high"
          ? "Alta confianza"
          : fields.confidence === "medium"
            ? "Revisa los datos"
            : "Baja confianza — corrige a mano";
      const missing = missingScanFieldLabels(fields);
      setScanHint(
        [
          conf,
          proposedPrice != null
            ? `Precio propuesto ${formatPrice(proposedPrice)} (editable)`
            : null,
          missing.length
            ? `Falta completar: ${missing.join(", ")}`
            : "Ficha completa (revisa igual)",
          fields.notes || null,
          suffix || null,
        ]
          .filter(Boolean)
          .join(" · ")
      );
    }

    try {
      const { dataUrl } = await imageFileToDataUrl(file);
      if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");

      const { status, payload } = await fetchScanLabel(dataUrl, abort.signal);

      // Partial identity: apply what we got without wiping typed fields; warn.
      if (status === 422 && payload.fields) {
        const patch = scanFieldsToDraftPatch(payload.fields);
        setDraft((prev) => {
          const merged = mergeScanPatchIntoDraft(prev, {
            ...patch,
            name: patch.name || prev.name,
            winery: patch.winery || prev.winery,
          });
          return {
            ...merged,
            cellarId: prev.cellarId ?? activeCellarId,
            location: prev.location || initialSlot || "",
          };
        });
        setLabelImageDataUrl(dataUrl);
        setFromExisting(false);
        setStep("form");
        setError(
          payload.error ||
            "No identifiqué el vino con certeza. Completa o corrige a mano."
        );
        setScanHint(
          payload.fields.notes
            ? `Baja confianza · ${payload.fields.notes}`
            : "Baja confianza — revisa y completa los campos"
        );
        return;
      }

      if (status !== 200 || !payload.fields?.name) {
        const msg = payload.error || "No se pudo leer la etiqueta.";
        if (status === 429) {
          throw new Error("Demasiadas consultas. Espera un momento y reintenta.");
        }
        if (status >= 500) {
          throw new Error(
            msg.includes("Kimi") || msg.includes("API")
              ? msg
              : "Error del servidor al escanear. Reintenta."
          );
        }
        throw new Error(msg);
      }

      const fields = payload.fields;
      const patch = scanFieldsToDraftPatch(fields);
      let proposedPrice: number | null = null;
      setDraft((prev) => {
        const merged = mergeScanPatchIntoDraft(prev, patch);
        proposedPrice =
          prev.price == null && patch.price != null ? patch.price : null;
        return {
          ...merged,
          cellarId: prev.cellarId ?? activeCellarId,
          location: prev.location || initialSlot || "",
        };
      });
      setLabelImageDataUrl(dataUrl);
      setFromExisting(false);
      setStep("form");
      applyFieldsHint(
        fields,
        proposedPrice,
        payload.needsEnrich ? "Buscando precio de referencia…" : undefined
      );

      // Identity is already on screen — enrich market data in the background.
      if (payload.needsEnrich) {
        const enrichAbort = new AbortController();
        enrichAbortRef.current = enrichAbort;
        setEnriching(true);
        const enrichTimeout = window.setTimeout(
          () => enrichAbort.abort(),
          35_000
        );
        void (async () => {
          try {
            const enriched = await fetchEnrichLabel(
              fields,
              payload.enrichHint,
              enrichAbort.signal
            );
            if (!enriched || enrichAbort.signal.aborted) return;
            const enrichPatch = scanFieldsToDraftPatch(enriched);
            let newPrice: number | null = null;
            setDraft((prev) => {
              newPrice =
                prev.price == null && enrichPatch.price != null
                  ? enrichPatch.price
                  : null;
              return mergeScanPatchIntoDraft(prev, enrichPatch);
            });
            applyFieldsHint(enriched, newPrice);
          } catch {
            /* keep vision-only result */
          } finally {
            window.clearTimeout(enrichTimeout);
            if (enrichAbortRef.current === enrichAbort) {
              enrichAbortRef.current = null;
            }
            setEnriching(false);
          }
        })();
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError(
          "El escaneo se canceló o tardó demasiado. Reintenta con otra foto."
        );
      } else if (e instanceof TypeError) {
        setError("Sin conexión al escanear. Revisa internet y reintenta.");
      } else {
        setError(e instanceof Error ? e.message : "Error al escanear.");
      }
      // Do not mutate draft on hard failure — keep what the user already typed.
    } finally {
      window.clearTimeout(timeoutId);
      if (scanAbortRef.current === abort) scanAbortRef.current = null;
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  }

  function retryLastScan() {
    if (lastScanFile && !scanning) {
      void handleScanFile(lastScanFile);
      return;
    }
    scanInputRef.current?.click();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError(t("wine.nameRequired"));
      return;
    }
    if (!draft.country.trim()) {
      setError(t("wine.countryRequired"));
      return;
    }

    const loc = parseLocation(draft.location);
    if (loc.slot && loc.slot !== "abajo") {
      const cellarId = draft.cellarId ?? activeCellarId;
      const taken = getWineBySlot(wines, loc.slot, cellarId);
      if (taken && taken.id !== editing?.id) {
        setError(t("wine.slotTaken", { slot: loc.slot, name: taken.name }));
        return;
      }
    }

    onSubmit(
      {
        ...draft,
        cellarId:
          loc.slot === "abajo" || !loc.slot
            ? null
            : draft.cellarId ?? activeCellarId,
        location: loc.slot ?? "",
      },
      labelImageDataUrl
        ? { labelImageDataUrl }
        : undefined
    );
    onClose();
  }

  const showingPick = !editing && step === "pick";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,18,16,0.45)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wine-form-title"
      onClick={onClose}
    >
      <div
        className="panel max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[18px] p-4 sm:rounded-[14px] sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={scanInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void handleScanFile(e.target.files?.[0])}
        />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="wine-form-title" className="display text-2xl text-ink">
              {editing
                ? t("wine.editWine")
                : showingPick
                  ? catalog.length === 0
                    ? t("wine.firstBottle")
                    : t("wine.whichBottle")
                  : fromExisting
                    ? prefillDraft
                      ? t("wine.addToCellarTitle")
                      : t("wine.anotherBottle")
                    : t("wine.newWine")}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {editing
                ? t("wine.editSubtitle")
                : showingPick
                  ? catalog.length === 0
                    ? initialSlot
                      ? t("wine.firstBottleSlotHint", { slot: initialSlot })
                      : t("wine.firstBottleHint")
                    : initialSlot
                      ? t("wine.pickSlotHint", { slot: initialSlot })
                      : t("wine.pickOrNew")
                  : fromExisting
                    ? prefillDraft
                      ? t("wine.scanPrefillHint")
                      : t("wine.copiedDataHint")
                    : t("wine.completeNewWine")}
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

        {showingPick ? (
          <div className="space-y-3">
            {catalog.length > 0 ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    {t("wine.searchInCellar")}
                  </span>
                  <input
                    className={fieldClass}
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder={t("filters.searchShortPlaceholder")}
                    enterKeyHint="search"
                  />
                </label>

                <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.alreadyInCellar", { count: filteredCatalog.length })}
                  {initialSlot ? t("wine.goesToSlot", { slot: initialSlot }) : ""}
                </p>

                <ul className="max-h-[min(50dvh,22rem)] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                  {filteredCatalog.length === 0 ? (
                    <li className="rounded-[10px] border border-dashed border-[var(--line)] px-3 py-4 text-sm text-ink-soft">
                      {t("wine.noCatalogMatches")}
                    </li>
                  ) : (
                    filteredCatalog.map((w) => {
                      const copies = wines.filter(
                        (x) => wineKey(x) === wineKey(w)
                      ).length;
                      return (
                        <li key={wineKey(w)}>
                          <button
                            type="button"
                            onClick={() => applyExisting(w)}
                            className="flex w-full items-start gap-2 rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] px-3 py-2.5 text-left transition hover:border-[rgba(110,31,44,0.35)] hover:bg-[rgba(110,31,44,0.06)]"
                          >
                            <span
                              className="mt-0.5 text-base leading-none"
                              aria-hidden
                            >
                              {countryFlagEmoji[w.country] ?? "·"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-ink">
                                {w.name}
                              </span>
                              <span className="block truncate text-xs text-ink-soft">
                                {[
                                  w.winery,
                                  w.vintage,
                                  w.cavataleRating != null
                                    ? formatCavataleRating(w.cavataleRating)
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs text-ink-soft">
                              {copies > 1
                                ? t("wine.bottlesShort", { count: copies })
                                : t("wine.bottlesShort", { count: 1 })}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            ) : null}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-primary flex min-h-[48px] w-full items-center justify-center disabled:opacity-60"
                disabled={scanning}
                aria-busy={scanning}
                onClick={() => scanInputRef.current?.click()}
              >
                {scanning ? (
                  <ThinkingIndicator
                    tone="cream"
                    size="sm"
                    label={t("wine.identifyingLabel")}
                  />
                ) : (
                  t("wine.scanLabel")
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost flex min-h-[48px] w-full items-center justify-center border border-[var(--line)]"
                disabled={scanning}
                onClick={startBlank}
              >
                {t("wine.writeByHand")}
              </button>
            </div>
            {error && showingPick ? (
              <div className="space-y-2">
                <p className="text-sm text-[var(--wine)]" role="alert">
                  {error}
                </p>
                <button
                  type="button"
                  className="btn btn-ghost min-h-[40px] w-full border border-[var(--line)] text-sm disabled:opacity-60"
                  disabled={scanning}
                  onClick={() => retryLastScan()}
                >
                  {t("wine.retryScan")}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!editing ? (
              <button
                type="button"
                className="mb-3 text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                onClick={() => {
                  setStep("pick");
                  setCatalogQuery("");
                  setScanHint("");
                }}
              >
                {catalog.length === 0
                  ? t("wine.scanOrWrite")
                  : t("wine.chooseFromCellar")}
              </button>
            ) : null}

            <div className="mb-3 flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-ghost flex min-h-[44px] w-full items-center justify-center border border-[var(--line)] disabled:opacity-60"
                disabled={scanning}
                aria-busy={scanning}
                onClick={() => scanInputRef.current?.click()}
              >
                {scanning ? (
                  <ThinkingIndicator
                    tone="wine"
                    size="sm"
                    label={t("wine.identifyingLabel")}
                  />
                ) : editing ? (
                  t("wine.fillFromPhoto")
                ) : (
                  t("wine.scanLabel")
                )}
              </button>
              {scanHint ? (
                <p className="text-xs text-ink-soft">
                  {enriching && !scanHint.includes(t("scan.enriching").slice(0, 8))
                    ? `${scanHint} · ${t("scan.enriching")}`
                    : scanHint}
                </p>
              ) : enriching ? (
                <p className="text-xs text-ink-soft">{t("scan.enriching")}</p>
              ) : null}
              {error ? (
                <button
                  type="button"
                  className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
                  disabled={scanning}
                  onClick={() => retryLastScan()}
                >
                  {t("wine.retryScan")}
                </button>
              ) : null}
              {labelImageDataUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={labelImageDataUrl}
                    alt={t("wine.scannedLabelAlt")}
                    className="h-16 w-12 rounded-[8px] object-cover"
                  />
                  <p className="text-xs text-ink-soft">
                    {t("wine.labelWillSave")}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.name")} *
                </span>
                <input
                  className={fieldClass}
                  value={draft.name}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder={t("wine.namePlaceholder")}
                  required
                  autoFocus={!fromExisting}
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.winery")}
                </span>
                <input
                  className={fieldClass}
                  value={draft.winery}
                  onChange={(e) => patch("winery", e.target.value)}
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.type")}
                </span>
                <select
                  className={fieldClass}
                  value={draft.type}
                  onChange={(e) => patch("type", e.target.value)}
                >
                  {(["Tinto", "Blanco", "Rosado", "Espumoso"] as const).map(
                    (typeValue) => (
                      <option key={typeValue} value={typeValue}>
                        {wineTypeLabel(dict, typeValue)}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.country")} *
                </span>
                <select
                  className={fieldClass}
                  value={draft.country}
                  onChange={(e) => patch("country", e.target.value)}
                >
                  {Object.keys(countryFlagEmoji).map((c) => (
                    <option key={c} value={c}>
                      {countryFlagEmoji[c]} {countryDisplayName(c, locale)}
                    </option>
                  ))}
                  <option value="Otro">{countryDisplayName("Otro", locale)}</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.region")}
                </span>
                <input
                  className={fieldClass}
                  value={draft.region}
                  onChange={(e) => patch("region", e.target.value)}
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.grape")}
                </span>
                <input
                  className={fieldClass}
                  value={draft.grape}
                  onChange={(e) => patch("grape", e.target.value)}
                  placeholder={t("wine.grapePlaceholder")}
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.aging")}
                </span>
                <input
                  className={fieldClass}
                  value={draft.aging}
                  onChange={(e) => patch("aging", e.target.value)}
                  placeholder={t("wine.agingPlaceholder")}
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.year")}
                </span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={draft.vintage ?? ""}
                  onChange={(e) =>
                    patch("vintage", parseOptionalNumber(e.target.value))
                  }
                  placeholder="2021"
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.priceMxn")}
                </span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={draft.price ?? ""}
                  onChange={(e) =>
                    patch("price", parseOptionalNumber(e.target.value))
                  }
                  placeholder={t("wine.pricePlaceholder")}
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.furniture")}
                </span>
                <select
                  className={fieldClass}
                  value={draft.cellarId ?? activeCellarId ?? ""}
                  onChange={(e) => {
                    const nextId = e.target.value ? e.target.value : null;
                    setDraft((prev) => {
                      const loc = parseLocation(prev.location);
                      if (!loc.slot || loc.slot === "abajo") {
                        return { ...prev, cellarId: nextId };
                      }
                      const unit = cellars.find((c) => c.id === nextId);
                      if (!unit) return { ...prev, cellarId: nextId };
                      const stillFree = getEmptySlots(
                        wines,
                        unit.cols,
                        unit.rows,
                        unit.id
                      ).includes(loc.slot);
                      const keepOwn =
                        editing?.cellarId === unit.id &&
                        editing.slot === loc.slot;
                      return {
                        ...prev,
                        cellarId: nextId,
                        location: stillFree || keepOwn ? prev.location : "",
                      };
                    });
                  }}
                >
                  {cellars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.cols}×{c.rows.length})
                    </option>
                  ))}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {t("wine.location")}
                </span>
                <select
                  className={fieldClass}
                  value={draft.location}
                  onChange={(e) => patch("location", e.target.value)}
                >
                  <option value="">{t("wine.noSlot")}</option>
                  <option value="abajo">{t("wine.belowOut")}</option>
                  {emptySlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {t("wine.slotLabel", { slot })}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-[var(--wine)]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn btn-ghost min-h-[44px]"
                onClick={onClose}
                disabled={scanning}
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="btn btn-primary min-h-[44px]"
                disabled={scanning}
              >
                {editing ? t("wine.saveChanges") : t("wine.addToCellar")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
