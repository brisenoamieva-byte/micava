"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AiTheaterStatus } from "@/components/AiTheaterStatus";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import {
  assessKimiStoryQuality,
  emptyKimiResearch,
  type KimiResearch,
} from "@/lib/kimi-research";
import {
  imageFileToDataUrl,
  mergeScanPatchIntoDraft,
  scanFieldsToDraftPatch,
  type ScanLabelFields,
} from "@/lib/scan-label";
import type { Encounter, EncounterDraft, WineDraft } from "@/lib/types";
import { formatCavataleRating } from "@/lib/wines";

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
  const [step, setStep] = useState<Step>("identify");
  const [identity, setIdentity] = useState<EncounterDraft>(emptyIdentity);
  const [research, setResearch] = useState<KimiResearch>(emptyKimiResearch);
  const [scanning, setScanning] = useState(false);
  const [scanHint, setScanHint] = useState("");
  const [error, setError] = useState("");
  const [kimiLoading, setKimiLoading] = useState(false);
  const [thinHint, setThinHint] = useState(false);
  const [saved, setSaved] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanAbortRef = useRef<AbortController | null>(null);
  const researchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("identify");
    setIdentity(emptyIdentity());
    setResearch(emptyKimiResearch);
    setScanning(false);
    setScanHint("");
    setError("");
    setKimiLoading(false);
    setThinHint(false);
    setSaved(false);
    scanAbortRef.current?.abort();
    researchAbortRef.current?.abort();
  }, [open]);

  useEffect(() => {
    return () => {
      scanAbortRef.current?.abort();
      researchAbortRef.current?.abort();
    };
  }, []);

  if (!open) return null;

  async function handleScanFile(file: File | undefined) {
    if (!file || scanning) return;
    setScanning(true);
    setError("");
    setScanHint("");
    scanAbortRef.current?.abort();
    const abort = new AbortController();
    scanAbortRef.current = abort;
    const timeoutId = window.setTimeout(() => abort.abort(), 55_000);

    try {
      const { dataUrl } = await imageFileToDataUrl(file);
      if (abort.signal.aborted) throw new DOMException("Aborted", "AbortError");

      const res = await fetch("/api/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
        signal: abort.signal,
      });
      const raw = await res.text();
      let payload: { error?: string; fields?: ScanLabelFields } = {};
      try {
        payload = JSON.parse(raw) as {
          error?: string;
          fields?: ScanLabelFields;
        };
      } catch {
        throw new Error(
          res.status === 504 || res.status === 408
            ? "El escaneo tardó demasiado. Intenta de nuevo con mejor luz."
            : "No se pudo leer la etiqueta. Reintenta."
        );
      }

      if ((res.ok || res.status === 422) && payload.fields) {
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
          res.status === 422
            ? "Baja confianza — revisa el nombre y la bodega"
            : payload.fields.confidence === "high"
              ? "Alta confianza — revisa y continúa"
              : "Revisa los datos antes de contar la historia"
        );
        if (res.status === 422) {
          setError(
            payload.error ||
              "No identifiqué el vino con certeza. Completa o corrige a mano."
          );
        }
        return;
      }

      if (!res.ok || !payload.fields) {
        throw new Error(payload.error || "No se pudo leer la etiqueta.");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("El escaneo se canceló o tardó demasiado.");
      } else if (e instanceof TypeError) {
        setError("Sin conexión al escanear. Revisa internet y reintenta.");
      } else {
        setError(e instanceof Error ? e.message : "Error al escanear.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (scanAbortRef.current === abort) scanAbortRef.current = null;
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  }

  function goToStory(e?: FormEvent) {
    e?.preventDefault();
    if (!identity.name.trim()) {
      setError("El nombre del vino es obligatorio.");
      return;
    }
    setError("");
    setStep("story");
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
        throw new Error("La IA respondió en un formato inesperado. Reintenta.");
      }
      if (!res.ok || !payload.research) {
        if (res.status === 429) {
          throw new Error("Demasiadas consultas. Espera un momento y reintenta.");
        }
        throw new Error(payload.error || "No se pudo contar la historia.");
      }
      setResearch(payload.research);
      const quality = assessKimiStoryQuality(payload.research);
      setThinHint(Boolean(payload.thinStory) || quality.thin);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("La consulta se canceló o tardó demasiado.");
      } else if (e instanceof TypeError) {
        setError("Sin conexión. Revisa internet y reintenta.");
      } else {
        setError(e instanceof Error ? e.message : "Error al investigar.");
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
      setError("Cuenta la historia primero — es el corazón del encuentro.");
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
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--wine)]">
              Encuentro
            </p>
            <h2 id="encuentro-title" className="display mt-1 text-2xl text-ink">
              {step === "identify"
                ? "Contar una botella"
                : "La historia en la mesa"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {step === "identify"
                ? "Historia para esta mesa · sin sumarla a tu cava"
                : "Primero el gancho para decir en voz alta — luego el relato completo."}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost min-h-[40px] px-3 text-sm"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        {error ? (
          <p className="mb-3 text-sm text-[var(--wine)]" role="alert">
            {error}
          </p>
        ) : null}

        {step === "identify" ? (
          <form className="space-y-3" onSubmit={goToStory}>
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
                  label="Leyendo la etiqueta…"
                />
              ) : (
                "Escanear etiqueta"
              )}
            </button>
            {scanHint ? (
              <p className="text-xs text-ink-soft">{scanHint}</p>
            ) : null}

            <p className="text-center text-xs text-ink-soft">o escribe el nombre</p>

            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Nombre *
              </span>
              <input
                className={fieldClass}
                value={identity.name}
                onChange={(e) =>
                  setIdentity((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Ej. Catena Malbec"
                required
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Bodega
              </span>
              <input
                className={fieldClass}
                value={identity.winery}
                onChange={(e) =>
                  setIdentity((prev) => ({ ...prev, winery: e.target.value }))
                }
                placeholder="Opcional"
                autoComplete="off"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  País
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
                  Año
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
                  Tipo
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
                  Región
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
                Uva
              </span>
              <input
                className={fieldClass}
                value={identity.grape}
                onChange={(e) =>
                  setIdentity((prev) => ({ ...prev, grape: e.target.value }))
                }
                placeholder="Opcional"
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary min-h-[48px] w-full text-base"
            >
              Continuar · Contar historia
            </button>
          </form>
        ) : null}

        {step === "story" ? (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] px-3 py-2.5">
              <p className="font-medium text-ink">{identity.name}</p>
              <p className="text-xs text-ink-soft">
                {[identity.winery, identity.vintage, identity.country]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <button
                type="button"
                className="mt-1 text-xs text-ink-soft underline-offset-2 hover:underline"
                onClick={() => setStep("identify")}
              >
                Corregir identidad
              </button>
            </div>

            <div className="discovery-stage">
              {!hasStory && !kimiLoading ? (
                <div>
                  <h3 className="display text-[1.65rem] leading-tight text-ink">
                    ¿Qué se dice en esta mesa?
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
                    Una frase para lanzar con la copa en la mano — y detrás, la
                    historia completa. Ritual de mesa, no del mapa.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary mt-4 min-h-[48px] w-full text-base disabled:opacity-60"
                    disabled={kimiLoading}
                    onClick={() => void handleResearch()}
                  >
                    Contar la historia de este vino
                  </button>
                </div>
              ) : null}

              <AiTheaterStatus active={kimiLoading} className="mt-2" />

              {hasStory ? (
                <div className="mt-2 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--wine)]">
                      Esta mesa
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
                          label="Contando…"
                        />
                      ) : (
                        "Actualizar"
                      )}
                    </button>
                  </div>
                  {research.kimiTalkHook ? (
                    <div className="rounded-[12px] border border-[rgba(110,31,44,0.28)] bg-[rgba(110,31,44,0.07)] px-3.5 py-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--wine)]">
                        Para decir en la mesa
                      </p>
                      <p className="display mt-2 text-[1.35rem] leading-snug text-ink sm:text-[1.5rem]">
                        {research.kimiTalkHook}
                      </p>
                    </div>
                  ) : null}
                  {research.kimiSummary ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        Historia
                      </p>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
                        {research.kimiSummary}
                      </p>
                    </div>
                  ) : null}
                  {research.kimiCuriosity ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        Dato curioso
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink">
                        {research.kimiCuriosity}
                      </p>
                    </div>
                  ) : null}
                  {thinHint ? (
                    <p className="text-xs text-ink-soft">
                      Si suena a ficha de tienda, Actualizar suele dar otra
                      versión.
                    </p>
                  ) : null}
                  {research.cavataleRating != null ? (
                    <div className="rounded-[10px] border border-[rgba(110,31,44,0.28)] bg-[rgba(110,31,44,0.08)] px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
                        Calificación Cavatale
                      </p>
                      <p className="display mt-1 text-3xl leading-none text-ink">
                        {formatCavataleRating(research.cavataleRating)}
                      </p>
                      <p className="mt-1.5 text-xs text-ink-soft">
                        Oficial Cavatale · independiente de Vivino.
                      </p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary min-h-[48px] w-full text-base disabled:opacity-60"
                    disabled={saved}
                    onClick={() => handleSave(false)}
                  >
                    Guardar en mi bitácora
                  </button>
                  {onAlsoAddToCava ? (
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[44px] w-full text-sm disabled:opacity-60"
                      disabled={saved}
                      onClick={() => handleSave(true)}
                    >
                      Guardar y sumar a mi cava
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
