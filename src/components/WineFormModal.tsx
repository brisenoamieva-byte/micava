"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Wine, WineDraft } from "@/lib/types";
import {
  countryFlagEmoji,
  formatPrice,
  formatVivino,
  getEmptySlots,
  getWineBySlot,
  parseLocation,
} from "@/lib/wines";
import { wineToDraft } from "@/lib/cellar-store";
import {
  imageFileToDataUrl,
  mergeScanPatchIntoDraft,
  missingScanFieldLabels,
  scanFieldsToDraftPatch,
  type ScanLabelFields,
} from "@/lib/scan-label";

type Props = {
  open: boolean;
  wines: Wine[];
  cellars: { id: string; name: string; cols: number; rows: string[] }[];
  activeCellarId: string | null;
  initialSlot?: string;
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
      (x.vivino != null ? 2 : 0) + (x.price != null ? 1 : 0) + (x.grape ? 1 : 0);
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
  editing = null,
  onClose,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState<WineDraft>(
    emptyDraft(initialSlot, activeCellarId)
  );
  const [error, setError] = useState("");
  /** When adding: pick from catalog first, or go straight to form. */
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [fromExisting, setFromExisting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanHint, setScanHint] = useState("");
  const [labelImageDataUrl, setLabelImageDataUrl] = useState<string | null>(
    null
  );
  const scanInputRef = useRef<HTMLInputElement>(null);

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
    setScanHint("");
    setLabelImageDataUrl(null);
    if (editing) {
      setStep("form");
      setDraft(wineToDraft(editing));
    } else {
      setDraft(emptyDraft(initialSlot, activeCellarId));
      setStep(catalog.length > 0 ? "pick" : "form");
    }
  }, [open, editing, initialSlot, activeCellarId, catalog.length]);

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
    setScanning(true);
    setError("");
    setScanHint("");
    try {
      const { dataUrl } = await imageFileToDataUrl(file);
      const res = await fetch("/api/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
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
          res.ok
            ? "La IA respondió en un formato inesperado."
            : "El servidor tardó demasiado o falló. Intenta de nuevo."
        );
      }
      if (!res.ok || !payload.fields) {
        throw new Error(payload.error || "No se pudo leer la etiqueta.");
      }
      const patch = scanFieldsToDraftPatch(payload.fields);
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
      const conf =
        payload.fields.confidence === "high"
          ? "Alta confianza"
          : payload.fields.confidence === "medium"
            ? "Revisa los datos"
            : "Baja confianza — corrige a mano";
      const missing = missingScanFieldLabels(payload.fields);
      setScanHint(
        [
          conf,
          proposedPrice != null
            ? `Precio propuesto ${formatPrice(proposedPrice)} (editable)`
            : null,
          missing.length
            ? `Falta completar: ${missing.join(", ")}`
            : "Ficha completa (revisa igual)",
          payload.fields.notes || null,
        ]
          .filter(Boolean)
          .join(" · ")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al escanear.");
    } finally {
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError("El nombre del vino es obligatorio.");
      return;
    }
    if (!draft.country.trim()) {
      setError("Indica el país.");
      return;
    }

    const loc = parseLocation(draft.location);
    if (loc.slot && loc.slot !== "abajo") {
      const cellarId = draft.cellarId ?? activeCellarId;
      const taken = getWineBySlot(wines, loc.slot, cellarId);
      if (taken && taken.id !== editing?.id) {
        setError(`El slot ${loc.slot} ya está ocupado por ${taken.name}.`);
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
                ? "Editar vino"
                : showingPick
                  ? "¿Qué botella sumas?"
                  : fromExisting
                    ? "Otra botella"
                    : "Vino nuevo"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {editing
                ? "Actualiza datos o ubicación de la botella."
                : showingPick
                  ? initialSlot
                    ? `Casilla ${initialSlot} · elige un vino de tu cava o uno nuevo.`
                    : "Elige uno que ya tengas, o agrega uno distinto."
                  : fromExisting
                    ? "Datos copiados · elige mueble y ubicación."
                    : "Completa los datos de un vino que aún no está en tu cava."}
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

        {showingPick ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Buscar en tu cava
              </span>
              <input
                className={fieldClass}
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Nombre, bodega, uva…"
                enterKeyHint="search"
              />
            </label>

            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Ya en tu cava ({filteredCatalog.length})
              {initialSlot ? ` · va a ${initialSlot}` : ""}
            </p>

            <ul className="max-h-[min(50dvh,22rem)] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
              {filteredCatalog.length === 0 ? (
                <li className="rounded-[10px] border border-dashed border-[var(--line)] px-3 py-4 text-sm text-ink-soft">
                  No hay coincidencias. Prueba otra búsqueda o agrega uno nuevo.
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
                        <span className="mt-0.5 text-base leading-none" aria-hidden>
                          {countryFlagEmoji[w.country] ?? "·"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">
                            {w.name}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            {[w.winery, w.vintage, formatVivino(w.vivino)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-soft">
                          {copies > 1 ? `${copies} bot.` : "1 bot."}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-primary flex min-h-[48px] w-full items-center justify-center disabled:opacity-60"
                disabled={scanning}
                onClick={() => scanInputRef.current?.click()}
              >
                {scanning
                  ? "Identificando y buscando rating…"
                  : "Escanear etiqueta"}
              </button>
              <button
                type="button"
                className="btn btn-ghost flex min-h-[48px] w-full items-center justify-center border border-[var(--line)]"
                disabled={scanning}
                onClick={startBlank}
              >
                Escribir a mano
              </button>
            </div>
            {error && showingPick ? (
              <p className="text-sm text-[var(--wine)]">{error}</p>
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
                ← Elegir de mi cava
              </button>
            ) : null}

            <div className="mb-3 flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-ghost flex min-h-[44px] w-full items-center justify-center border border-[var(--line)] disabled:opacity-60"
                disabled={scanning}
                onClick={() => scanInputRef.current?.click()}
              >
                {scanning
                  ? "Identificando y buscando rating…"
                  : editing
                    ? "Rellenar desde foto"
                    : "Escanear etiqueta"}
              </button>
              {scanHint ? (
                <p className="text-xs text-ink-soft">{scanHint}</p>
              ) : null}
              {labelImageDataUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={labelImageDataUrl}
                    alt="Etiqueta escaneada"
                    className="h-16 w-12 rounded-[8px] object-cover"
                  />
                  <p className="text-xs text-ink-soft">
                    Esta foto se guardará con el vino.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Nombre *
                </span>
                <input
                  className={fieldClass}
                  value={draft.name}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder="Ej. Viña Alberdi"
                  required
                  autoFocus={!fromExisting}
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Bodega
                </span>
                <input
                  className={fieldClass}
                  value={draft.winery}
                  onChange={(e) => patch("winery", e.target.value)}
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Tipo
                </span>
                <select
                  className={fieldClass}
                  value={draft.type}
                  onChange={(e) => patch("type", e.target.value)}
                >
                  <option>Tinto</option>
                  <option>Blanco</option>
                  <option>Rosado</option>
                  <option>Espumoso</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  País *
                </span>
                <select
                  className={fieldClass}
                  value={draft.country}
                  onChange={(e) => patch("country", e.target.value)}
                >
                  {Object.keys(countryFlagEmoji).map((c) => (
                    <option key={c} value={c}>
                      {countryFlagEmoji[c]} {c}
                    </option>
                  ))}
                  <option value="Otro">Otro</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Región
                </span>
                <input
                  className={fieldClass}
                  value={draft.region}
                  onChange={(e) => patch("region", e.target.value)}
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Uva
                </span>
                <input
                  className={fieldClass}
                  value={draft.grape}
                  onChange={(e) => patch("grape", e.target.value)}
                  placeholder="Tempranillo, Malbec…"
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Añejamiento
                </span>
                <input
                  className={fieldClass}
                  value={draft.aging}
                  onChange={(e) => patch("aging", e.target.value)}
                  placeholder="Reserva, 12 meses…"
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Año
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
                  Vivino
                </span>
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={draft.vivino ?? ""}
                  onChange={(e) =>
                    patch("vivino", parseOptionalNumber(e.target.value))
                  }
                  placeholder="4.1"
                />
              </label>

              <label>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Precio (MXN)
                </span>
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={draft.price ?? ""}
                  onChange={(e) =>
                    patch("price", parseOptionalNumber(e.target.value))
                  }
                  placeholder="Propuesto por Kimi si hay dato"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Mueble
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
                  Ubicación
                </span>
                <select
                  className={fieldClass}
                  value={draft.location}
                  onChange={(e) => patch("location", e.target.value)}
                >
                  <option value="">Sin ubicación</option>
                  <option value="abajo">Abajo / fuera</option>
                  {emptySlots.map((slot) => (
                    <option key={slot} value={slot}>
                      Slot {slot}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-[var(--wine)]">{error}</p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn btn-ghost min-h-[44px]"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary min-h-[44px]">
                {editing ? "Guardar cambios" : "Agregar a la cava"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
