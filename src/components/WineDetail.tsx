"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MatchConfidence, RatingSource, Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { parseGrapes } from "@/lib/grapes";
import {
  isThinKimiStory,
  normalizeUserCorrectionNote,
  type KimiResearch,
} from "@/lib/kimi-research";
import { resolveLabelImageUrl } from "@/lib/label-image";
import { resolvePairingsForWine } from "@/lib/pairings";
import {
  confidenceLabel,
  formatCheckedAt,
  ratingDelta,
  sourceLabel,
  vivinoSearchHomeUrl,
  vivinoTypeQuery,
  wineSearcherUrl,
} from "@/lib/rating-verify";
import { formatCavataleRating, formatPrice, formatVivino, typeAccent } from "@/lib/wines";
import { buildWineShareText, shareOrCopyText } from "@/lib/share-wine";
import { AiTheaterStatus } from "@/components/AiTheaterStatus";
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
  onGifted?: (wine: Wine) => void;
  onVerifyRating?: (
    wine: Wine,
    data: {
      externalRating: number;
      ratingSource: RatingSource;
      matchConfidence: MatchConfidence;
      syncVivino: boolean;
    }
  ) => void;
  onSaveKimiResearch?: (wine: Wine, research: KimiResearch) => number | void;
  /** Persist owner dispute note (feedback only, not truth). */
  onSaveKimiUserNote?: (wine: Wine, note: string | null) => number | void;
  onApplyKimiResearch?: (
    wine: Wine,
    fields: { vivino?: boolean; price?: boolean }
  ) => number | void;
  onMove?: (wine: Wine) => void;
};

export function WineDetail({
  wine,
  onBack,
  backLabel = "Volver",
  embeddedInSheet = false,
  onEdit,
  onRemove,
  onOpened,
  onGifted,
  onVerifyRating,
  onSaveKimiResearch,
  onSaveKimiUserNote,
  onApplyKimiResearch,
  onMove,
}: Props) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [ratingInput, setRatingInput] = useState("");
  const [source, setSource] = useState<RatingSource>("vivino");
  const [confidence, setConfidence] = useState<MatchConfidence>("confirmed");
  const [syncVivino, setSyncVivino] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [kimiLoading, setKimiLoading] = useState(false);
  const [kimiError, setKimiError] = useState("");
  const [researchJustDone, setResearchJustDone] = useState(false);
  const [thinStoryHint, setThinStoryHint] = useState(false);
  const [vivinoHint, setVivinoHint] = useState<string | null>(null);
  const [applyHint, setApplyHint] = useState<string | null>(null);
  const [labelSrc, setLabelSrc] = useState<string | null>(null);
  const [vivinoOffer, setVivinoOffer] = useState<{
    estimate: number;
    current: number | null;
  } | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const researchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setVerifyOpen(false);
    setRatingInput(
      wine?.externalRating != null ? String(wine.externalRating) : ""
    );
    setSource(wine?.ratingSource ?? "vivino");
    setConfidence(wine?.matchConfidence ?? "confirmed");
    setSyncVivino(false);
    setShareHint(null);
    setKimiLoading(false);
    setKimiError("");
    setResearchJustDone(false);
    setThinStoryHint(false);
    setVivinoHint(null);
    setApplyHint(null);
    setVivinoOffer(null);
    setLabelSrc(null);
    setCorrectionOpen(false);
    setCorrectionDraft(wine?.kimiUserNote ?? "");
    setCorrectionError("");
    researchAbortRef.current?.abort();
    researchAbortRef.current = null;
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

  if (!wine) {
    return (
      <div>
        {onBack && !embeddedInSheet ? (
          <button
            type="button"
            className="mobile-only mb-3 inline-flex min-h-[44px] items-center rounded-[10px] px-1 text-sm font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            onClick={onBack}
          >
            ← {backLabel}
          </button>
        ) : null}
        <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-ink-soft sm:min-h-[280px]">
          Selecciona un vino desde el mapa o la lista
        </div>
      </div>
    );
  }

  const classified = parseGrapes(wine.grape);
  const delta = ratingDelta(wine.vivino, wine.externalRating);
  const pairing = resolvePairingsForWine(wine);

  const facts: { label: string; value: ReactNode }[] = [
    {
      label: "País",
      value: <CountryFlag country={wine.country} size="sm" showLabel />,
    },
    { label: "Región", value: wine.region || "—" },
    { label: "Tipo", value: wine.type || "—" },
    { label: "Bodega", value: wine.winery || "—" },
    {
      label: "Uva",
      value: wine.grape
        ? classified.length > 0
          ? classified.join(" · ")
          : wine.grape
        : "—",
    },
    { label: "Año", value: wine.vintage ? String(wine.vintage) : "—" },
    { label: "Añejamiento", value: wine.aging || "—" },
    {
      label: "Ubicación",
      value:
        wine.slot === "abajo"
          ? "Abajo / fuera"
          : wine.slot
            ? `Slot ${wine.slot}`
            : "Sin ubicación",
    },
  ];

  function saveVerification() {
    const value = Number(ratingInput.replace(",", "."));
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      alert("Ingresa una calificación entre 1.0 y 5.0");
      return;
    }
    onVerifyRating?.(wine!, {
      externalRating: Math.round(value * 10) / 10,
      ratingSource: source,
      matchConfidence: confidence,
      syncVivino,
    });
    setVerifyOpen(false);
  }

  function applyKimiToFicha(fields: { vivino?: boolean; price?: boolean }) {
    if (!wine || !onApplyKimiResearch) return;

    const parts: string[] = [];
    if (fields.vivino && wine.kimiVivino != null) {
      parts.push(
        wine.vivino === wine.kimiVivino
          ? `Calificación Vivino ya era ${formatVivino(wine.kimiVivino)}`
          : `Calificación Vivino actualizada a ${formatVivino(wine.kimiVivino)}`
      );
    }
    if (fields.price && wine.kimiPrice != null) {
      parts.push(
        wine.price === wine.kimiPrice
          ? `Precio ya era ${formatPrice(wine.kimiPrice)}`
          : `Precio actualizado a ${formatPrice(wine.kimiPrice)}`
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

  async function openVivinoTypeahead(opts?: { withVintage?: boolean }) {
    if (!wine) return;
    const base = vivinoTypeQuery(wine);
    const q =
      opts?.withVintage && wine.vintage != null
        ? `${base} ${wine.vintage}`
        : base;

    let copied = false;
    try {
      await navigator.clipboard.writeText(q);
      copied = true;
    } catch {
      copied = false;
    }

    // Keep hint until the user acts again; show selectable text if clipboard failed.
    setVivinoHint(
      copied
        ? `Copiado: “${q}”. Pégalo (Ctrl/Cmd+V) en el buscador de Vivino.`
        : `Copia este texto y pégalo en Vivino: “${q}”`
    );

    // Open after copy so mobile browsers don't clear the clipboard mid-write.
    window.setTimeout(() => {
      window.open(vivinoSearchHomeUrl(), "_blank", "noopener,noreferrer");
    }, 60);
  }

  async function copyVivinoQueryAgain(withVintage = false) {
    if (!wine) return;
    const base = vivinoTypeQuery(wine);
    const q =
      withVintage && wine.vintage != null ? `${base} ${wine.vintage}` : base;
    try {
      await navigator.clipboard.writeText(q);
      setVivinoHint(`Copiado de nuevo: “${q}”`);
    } catch {
      setVivinoHint(`Selecciona y copia: “${q}”`);
    }
  }

  async function handleShare() {
    if (!wine) return;
    const text = buildWineShareText(wine);
    const result = await shareOrCopyText(text, wine.name);
    if (result === "copied") {
      setShareHint("Copiado");
      window.setTimeout(() => setShareHint(null), 2000);
    }
  }

  async function handleKimiResearch(opts?: {
    userCorrection?: string;
  }) {
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

    setKimiLoading(true);
    setKimiError("");
    setResearchJustDone(false);
    setThinStoryHint(false);
    setVivinoOffer(null);
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
          vivino: wine.vivino,
          cavataleRating: wine.cavataleRating,
          price: wine.price,
          ...(userCorrection ? { userCorrection } : {}),
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
      const applied = onSaveKimiResearch(wine, research);
      if (correctionFromSubmit && onSaveKimiUserNote) {
        onSaveKimiUserNote(wine, correctionFromSubmit);
      }
      const n = typeof applied === "number" ? applied : 1;
      setResearchJustDone(true);
      const thin =
        payload.thinStory === true || isThinKimiStory(research);
      setThinStoryHint(thin);
      setShareHint(
        n > 1 ? `Historia aplicada a ${n} botellas iguales` : "Historia lista"
      );
      window.setTimeout(() => setShareHint(null), 3500);
      if (correctionFromSubmit) {
        setCorrectionOpen(false);
        setCorrectionError("");
      }

      // Vivino: never auto-update. Offer only if high-conf and estimate differs.
      const est = research.kimiVivino;
      const highConf = research.kimiConfidence === "confirmed";
      const differs =
        est != null &&
        (wine.vivino == null || Math.abs(wine.vivino - est) >= 0.05);
      if (highConf && differs && est != null) {
        setVivinoOffer({ estimate: est, current: wine.vivino });
      } else {
        setVivinoOffer(null);
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

  const kimiDeltaVivino = ratingDelta(wine.vivino, wine.kimiVivino);
  const vivinoNeedsApply =
    wine.kimiVivino != null &&
    (wine.vivino == null ||
      Math.abs(wine.vivino - wine.kimiVivino) >= 0.05);
  const priceNeedsApply =
    wine.kimiPrice != null && wine.price !== wine.kimiPrice;
  const hasRefEstimates =
    wine.kimiVivino != null || wine.kimiPrice != null;
  const refsAllMatch =
    hasRefEstimates && !vivinoNeedsApply && !priceNeedsApply;
  const hasKimi =
    wine.kimiCheckedAt != null ||
    wine.cavataleRating != null ||
    wine.kimiVivino != null ||
    wine.kimiPrice != null ||
    Boolean(wine.kimiSummary) ||
    Boolean(wine.kimiCuriosity) ||
    Boolean(wine.kimiTalkHook);
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
          ← {backLabel}
        </button>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="micro-label text-ink-soft">Detalle</p>
          <h2 className="display mt-2 text-[1.85rem] leading-tight text-ink sm:text-3xl">
            {wine.name}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {wine.winery || "Bodega sin registrar"} · {wine.vintage ?? "s/a"}
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
          {wine.type}
        </span>
        {wine.cavataleRating != null ? (
          <span className="display text-2xl leading-none text-ink sm:text-[1.75rem]">
            {formatCavataleRating(wine.cavataleRating)}
            <span className="ml-1.5 align-middle font-sans text-[11px] font-normal uppercase tracking-[0.14em] text-ink-soft">
              Cavatale
            </span>
          </span>
        ) : null}
        <span className="text-xs text-ink-soft">
          Vivino {formatVivino(wine.vivino)}
          <span className="mx-1.5 text-[var(--line)]">·</span>
          {formatPrice(wine.price)}
          {wine.externalRating != null ? (
            <>
              <span className="mx-1.5 text-[var(--line)]">·</span>
              Verificado {formatVivino(wine.externalRating)}
              {delta != null && delta !== 0 ? (
                <span>
                  {" "}
                  ({delta > 0 ? "+" : ""}
                  {delta.toFixed(1)})
                </span>
              ) : null}
            </>
          ) : null}
        </span>
      </div>

      {onSaveKimiResearch ? (
        <div
          className="discovery-stage mt-5 sm:mt-6"
          aria-busy={kimiLoading || undefined}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="micro-label text-[var(--wine)]">Descubrimiento</p>
              {hasDiscoveryStory ? (
                <p className="mt-1 text-xs text-ink-soft">
                  Última consulta: {formatCheckedAt(wine.kimiCheckedAt)}
                  {wine.kimiConfidence
                    ? ` · ${confidenceLabel[wine.kimiConfidence]}`
                    : ""}
                </p>
              ) : (
                <h3 className="display mt-1.5 text-[1.65rem] leading-tight text-ink sm:text-2xl">
                  ¿Qué cuenta esta botella?
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
                  <ThinkingIndicator tone="wine" size="sm" label="Contando…" />
                ) : (
                  "Actualizar"
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
                Reintentar
              </button>
            </div>
          ) : null}

          <AiTheaterStatus active={kimiLoading} className="mt-2" />

          {researchJustDone && !kimiLoading && !kimiError ? (
            <p className="mt-2 text-sm text-[var(--wine-deep)]" role="status">
              {vivinoOffer
                ? "Historia lista. Abajo puedes aceptar o rechazar la calificación Vivino estimada."
                : "Historia lista. Calificación Cavatale y relato actualizados."}
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
                Contar la historia de este vino
              </button>
            </div>
          ) : null}

          {hasDiscoveryStory ? (
            <div className="mt-4 space-y-4">
              {wine.kimiSummary ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Historia
                  </p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink sm:text-base">
                    {wine.kimiSummary}
                  </p>
                </div>
              ) : null}
              {wine.kimiCuriosity ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Dato curioso
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">
                    {wine.kimiCuriosity}
                  </p>
                </div>
              ) : null}
              {wine.kimiTalkHook ? (
                <div className="rounded-[10px] border border-[rgba(110,31,44,0.2)] bg-[rgba(255,252,247,0.65)] px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Para conversar
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink italic">
                    {wine.kimiTalkHook}
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
                    Actualizar
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
                      ¿Algo incorrecto?
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        Reportar un error
                      </p>
                      <p className="text-xs leading-relaxed text-ink-soft">
                        Señala qué está mal (dato concreto). No inventamos
                        biografías a pedido. La IA contrastará tu nota; no la
                        tomará como verdad automática.
                      </p>
                      <label className="sr-only" htmlFor="kimi-correction-note">
                        Qué dato está mal
                      </label>
                      <textarea
                        id="kimi-correction-note"
                        rows={3}
                        maxLength={500}
                        value={correctionDraft}
                        disabled={kimiLoading}
                        placeholder="Corrige o aclara el dato concreto…"
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
                          Pedir revisión
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
                          Cancelar
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
                {shareHint ?? "Compartir historia"}
              </button>
            </div>
          ) : null}

          {hasKimi && wine.cavataleRating != null ? (
            <div className="mt-4 rounded-[10px] border border-[rgba(110,31,44,0.28)] bg-[rgba(110,31,44,0.08)] px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
                Calificación Cavatale
              </p>
              <p className="mt-1 display text-3xl leading-none text-ink">
                {formatCavataleRating(wine.cavataleRating)}
              </p>
              <p className="mt-1.5 text-xs text-ink-soft">
                Oficial Cavatale · ~30% sabor · ~30% historia · ~25% mesa ·
                ~15% originalidad.
              </p>
            </div>
          ) : null}

          {vivinoOffer ? (
            <div
              className="mt-4 rounded-[10px] border border-[rgba(110,31,44,0.28)] bg-[rgba(255,252,247,0.75)] px-3 py-3"
              role="status"
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                ¿Actualizar calificación Vivino (comunidad)?
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">
                Con alta confianza la IA estima{" "}
                <span className="font-medium">
                  {formatVivino(vivinoOffer.estimate)}
                </span>
                {vivinoOffer.current != null ? (
                  <>
                    {" "}
                    (en tu ficha tienes{" "}
                    <span className="font-medium">
                      {formatVivino(vivinoOffer.current)}
                    </span>
                    ).
                  </>
                ) : (
                  <> y tu ficha aún no tiene calificación Vivino.</>
                )}{" "}
                La calificación Cavatale no cambia con esto.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary min-h-[40px] px-3 text-sm"
                  onClick={() => {
                    applyKimiToFicha({ vivino: true });
                    setVivinoOffer(null);
                  }}
                >
                  Actualizar a {formatVivino(vivinoOffer.estimate)}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost min-h-[40px] px-3 text-sm"
                  onClick={() => {
                    setVivinoOffer(null);
                    setApplyHint(
                      vivinoOffer.current != null
                        ? `Se mantiene tu calificación Vivino ${formatVivino(vivinoOffer.current)}`
                        : "Se deja la ficha sin calificación Vivino"
                    );
                    window.setTimeout(() => setApplyHint(null), 4000);
                  }}
                >
                  {vivinoOffer.current != null
                    ? "Dejar el mío"
                    : "No actualizar"}
                </button>
              </div>
            </div>
          ) : null}

          {hasKimi && hasRefEstimates ? (
            <div className="mt-4 space-y-3 border-t border-[rgba(110,31,44,0.14)] pt-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Referencias (calificación Vivino / precio)
              </p>
              {refsAllMatch ? (
                <p className="text-sm text-ink-soft">
                  Coinciden con tu ficha
                  {wine.kimiVivino != null
                    ? ` · Vivino ${formatVivino(wine.kimiVivino)}`
                    : ""}
                  {wine.kimiPrice != null
                    ? ` · ${formatPrice(wine.kimiPrice)}`
                    : ""}
                  .
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {wine.kimiVivino != null ? (
                      <div>
                        {vivinoNeedsApply ? (
                          <>
                            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                              Vivino estimada
                            </p>
                            <p className="mt-1 text-sm text-ink">
                              {formatVivino(wine.kimiVivino)}
                              <span className="text-ink-soft">
                                {wine.vivino == null
                                  ? " · tu ficha no tiene calificación Vivino"
                                  : ` · tuya ${formatVivino(wine.vivino)}`}
                              </span>
                              {kimiDeltaVivino != null &&
                              kimiDeltaVivino !== 0 ? (
                                <span className="text-ink-soft">
                                  {" "}
                                  ({kimiDeltaVivino > 0 ? "+" : ""}
                                  {kimiDeltaVivino.toFixed(1)})
                                </span>
                              ) : null}
                            </p>
                            {onApplyKimiResearch ? (
                              <button
                                type="button"
                                className="mt-2 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                                onClick={() =>
                                  applyKimiToFicha({ vivino: true })
                                }
                              >
                                Usar esta calificación Vivino
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-sm text-ink-soft">
                            Vivino en ficha: {formatVivino(wine.vivino)}{" "}
                            (coincide con la estimación)
                          </p>
                        )}
                      </div>
                    ) : null}
                    {wine.kimiPrice != null ? (
                      <div>
                        {priceNeedsApply ? (
                          <>
                            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                              Precio estimado
                            </p>
                            <p className="mt-1 text-sm text-ink">
                              {formatPrice(wine.kimiPrice)}
                              <span className="text-ink-soft">
                                {wine.price == null
                                  ? " · tu ficha no tiene precio"
                                  : ` · tuyo ${formatPrice(wine.price)}`}
                              </span>
                            </p>
                            {onApplyKimiResearch ? (
                              <button
                                type="button"
                                className="mt-2 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                                onClick={() =>
                                  applyKimiToFicha({ price: true })
                                }
                              >
                                Usar este precio
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-sm text-ink-soft">
                            Precio en ficha: {formatPrice(wine.price)}{" "}
                            (coincide con la estimación)
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {onApplyKimiResearch &&
                  (vivinoNeedsApply || priceNeedsApply) ? (
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[44px] w-full text-sm"
                      onClick={() =>
                        applyKimiToFicha({
                          vivino: vivinoNeedsApply,
                          price: priceNeedsApply,
                        })
                      }
                    >
                      {vivinoNeedsApply && priceNeedsApply
                        ? "Aplicar calificación Vivino y precio a mi ficha"
                        : vivinoNeedsApply
                          ? "Aplicar calificación Vivino a mi ficha"
                          : "Aplicar precio a mi ficha"}
                    </button>
                  ) : null}
                </>
              )}
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
            alt={`Etiqueta de ${wine.name}`}
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
        <p className="micro-label text-ink-soft">Maridaje sugerido</p>
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

      {onVerifyRating ? (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="micro-label text-ink-soft">Calificación externa</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Última revisión: {formatCheckedAt(wine.lastCheckedAt)}
                {wine.ratingSource
                  ? ` · ${sourceLabel[wine.ratingSource]}`
                  : ""}
                {wine.matchConfidence
                  ? ` · ${confidenceLabel[wine.matchConfidence]}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost min-h-[40px] px-3 text-sm"
              onClick={() => setVerifyOpen((o) => !o)}
              aria-expanded={verifyOpen}
            >
              {verifyOpen ? "Cancelar" : "Verificar"}
            </button>
          </div>

          {verifyOpen ? (
            <div className="mt-3 space-y-3 rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] p-3">
              <p className="text-xs leading-relaxed text-ink-soft">
                Vivino acierta más si pegas en su buscador (typeahead) que si
                abres una URL con toda la consulta de golpe. Copiamos el texto y
                abrimos Vivino para que lo pegues.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost min-h-[40px] px-3 text-sm"
                  onClick={() => void openVivinoTypeahead()}
                >
                  Buscar en Vivino ↗
                </button>
                {wine.vintage != null ? (
                  <button
                    type="button"
                    className="btn btn-ghost min-h-[40px] px-3 text-sm"
                    onClick={() =>
                      void openVivinoTypeahead({ withVintage: true })
                    }
                  >
                    Con añada ({wine.vintage}) ↗
                  </button>
                ) : null}
                <a
                  href={wineSearcherUrl(wine)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost min-h-[40px] px-3 text-sm"
                >
                  Wine-Searcher ↗
                </a>
              </div>
              {vivinoHint ? (
                <div className="space-y-2 rounded-[8px] border border-[rgba(110,31,44,0.18)] bg-[rgba(110,31,44,0.05)] px-2.5 py-2">
                  <p className="text-xs text-ink">{vivinoHint}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--wine)] underline-offset-2 hover:underline"
                      onClick={() => void copyVivinoQueryAgain(false)}
                    >
                      Copiar otra vez
                    </button>
                    {wine.vintage != null ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-[var(--wine)] underline-offset-2 hover:underline"
                        onClick={() => void copyVivinoQueryAgain(true)}
                      >
                        Copiar con añada
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Score encontrado (1–5)
                </span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={0.1}
                  inputMode="decimal"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(e.target.value)}
                  className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 outline-none focus:border-[rgba(122,36,48,0.45)]"
                  placeholder="4.1"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Fuente
                  </span>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as RatingSource)}
                    className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2"
                  >
                    <option value="vivino">Vivino</option>
                    <option value="wine-searcher">Wine-Searcher</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Match
                  </span>
                  <select
                    value={confidence}
                    onChange={(e) =>
                      setConfidence(e.target.value as MatchConfidence)
                    }
                    className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2"
                  >
                    <option value="confirmed">Confirmado</option>
                    <option value="likely">Probable</option>
                    <option value="uncertain">Inseguro</option>
                  </select>
                </label>
              </div>

              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={syncVivino}
                  onChange={(e) => setSyncVivino(e.target.checked)}
                />
                <span>
                  Actualizar también mi calificación Vivino guardada
                  <span className="block text-xs text-ink-soft">
                    Ahora {formatVivino(wine.vivino)}
                  </span>
                </span>
              </label>

              <button
                type="button"
                className="btn btn-primary min-h-[44px] w-full"
                onClick={saveVerification}
              >
                Guardar verificación
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {(onOpened || onGifted || onEdit || onRemove || onMove) && (
        <div className="mt-6 min-w-0 space-y-2 border-t border-[var(--line)] pt-4">
          {(onOpened || onGifted) && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {onOpened ? (
                <button
                  type="button"
                  className="btn btn-primary min-h-[44px] min-w-0 w-full px-3"
                  onClick={() => onOpened(wine)}
                >
                  La abrí
                </button>
              ) : null}
              {onGifted ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] min-w-0 w-full px-3"
                  onClick={() => onGifted(wine)}
                >
                  La regalé
                </button>
              ) : null}
            </div>
          )}
          {(onEdit || onRemove || onMove) && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {onMove ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] min-w-0 w-full px-3"
                  onClick={() => onMove(wine)}
                >
                  Mover de mueble
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] min-w-0 w-full px-3"
                onClick={() => void handleShare()}
              >
                {shareHint ?? "Compartir"}
              </button>
              {onEdit ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] min-w-0 w-full px-3"
                  onClick={() => onEdit(wine)}
                >
                  Editar
                </button>
              ) : null}
              {onRemove ? (
                <button
                  type="button"
                  className="btn min-h-[44px] min-w-0 w-full border border-[rgba(110,31,44,0.35)] bg-[rgba(110,31,44,0.08)] px-3 text-[var(--wine-deep)] sm:col-span-2"
                  onClick={() => {
                    if (
                      confirm(
                        `¿Quitar “${wine.name}” de la cava?\nSe liberará su ubicación si tenía slot.`
                      )
                    ) {
                      onRemove(wine);
                    }
                  }}
                >
                  Quitar
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-ink-soft sm:mt-8">
        La calificación Cavatale es el score oficial de la plataforma. La
        calificación Vivino y el precio son referencia de comunidad/mercado. La
        verificación manual sigue disponible abajo.
      </p>
    </div>
  );
}
