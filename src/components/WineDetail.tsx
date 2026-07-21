"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { MatchConfidence, RatingSource, Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { parseGrapes } from "@/lib/grapes";
import type { KimiResearch } from "@/lib/kimi-research";
import { pairingsForWine } from "@/lib/pairings";
import {
  confidenceLabel,
  formatCheckedAt,
  ratingDelta,
  sourceLabel,
  vivinoSearchHomeUrl,
  vivinoTypeQuery,
  wineSearcherUrl,
} from "@/lib/rating-verify";
import { formatPrice, formatVivino, typeAccent } from "@/lib/wines";

function shareText(wine: Wine): string {
  const lines = [
    wine.name,
    [wine.winery, wine.vintage, wine.region].filter(Boolean).join(" · "),
    `Vivino ${formatVivino(wine.vivino)} · ${formatPrice(wine.price)}`,
    wine.slot ? `Ubicación: ${wine.slot}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

type Props = {
  wine: Wine | null;
  onBack?: () => void;
  backLabel?: string;
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
  onSaveKimiResearch?: (wine: Wine, research: KimiResearch) => void;
  onApplyKimiResearch?: (
    wine: Wine,
    fields: { vivino?: boolean; price?: boolean }
  ) => void;
};

export function WineDetail({
  wine,
  onBack,
  backLabel = "Volver",
  onEdit,
  onRemove,
  onOpened,
  onGifted,
  onVerifyRating,
  onSaveKimiResearch,
  onApplyKimiResearch,
}: Props) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [ratingInput, setRatingInput] = useState("");
  const [source, setSource] = useState<RatingSource>("vivino");
  const [confidence, setConfidence] = useState<MatchConfidence>("confirmed");
  const [syncVivino, setSyncVivino] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [kimiLoading, setKimiLoading] = useState(false);
  const [kimiError, setKimiError] = useState("");
  const [vivinoHint, setVivinoHint] = useState<string | null>(null);
  const [applyHint, setApplyHint] = useState<string | null>(null);

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
    setVivinoHint(null);
    setApplyHint(null);
  }, [wine?.id]);

  if (!wine) {
    return (
      <div>
        {onBack ? (
          <button
            type="button"
            className="mobile-only mb-3 text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
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
  const pairing = pairingsForWine(wine);

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
      value: wine.grape ? (
        classified.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {classified.map((g) => (
              <span
                key={g}
                className="rounded-[6px] border border-[var(--line)] bg-[rgba(255,252,247,0.7)] px-2 py-0.5 text-[11px] text-ink"
              >
                {g}
              </span>
            ))}
          </span>
        ) : (
          wine.grape
        )
      ) : (
        "—"
      ),
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
      alert("Ingresa un rating entre 1.0 y 5.0");
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
          ? `Vivino ya era ${formatVivino(wine.kimiVivino)}`
          : `Vivino actualizado a ${formatVivino(wine.kimiVivino)}`
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
      setApplyHint("No hay valores de Kimi para aplicar.");
      return;
    }

    onApplyKimiResearch(wine, fields);
    setApplyHint(`Guardado en tu ficha · ${parts.join(" · ")}`);
    window.setTimeout(() => setApplyHint(null), 5000);
  }

  async function openVivinoTypeahead() {
    if (!wine) return;
    const q = vivinoTypeQuery(wine);
    try {
      await navigator.clipboard.writeText(q);
      setVivinoHint(`Texto copiado: “${q}”. Pégalo en el buscador de Vivino.`);
    } catch {
      setVivinoHint(`Escribe en Vivino: “${q}”`);
    }
    window.open(vivinoSearchHomeUrl(), "_blank", "noopener,noreferrer");
    window.setTimeout(() => setVivinoHint(null), 8000);
  }

  async function handleShare() {
    if (!wine) return;
    const text = shareText(wine);
    try {
      if (navigator.share) {
        await navigator.share({ title: wine.name, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareHint("Copiado");
      window.setTimeout(() => setShareHint(null), 2000);
    } catch {
      // user cancelled share — ignore
    }
  }

  async function handleKimiResearch() {
    if (!wine || !onSaveKimiResearch || kimiLoading) return;
    setKimiLoading(true);
    setKimiError("");
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
          price: wine.price,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        research?: KimiResearch;
      };
      if (!res.ok || !payload.research) {
        throw new Error(payload.error || "No se pudo investigar este vino.");
      }
      onSaveKimiResearch(wine, payload.research);
    } catch (e) {
      setKimiError(e instanceof Error ? e.message : "Error al consultar Kimi.");
    } finally {
      setKimiLoading(false);
    }
  }

  const kimiDeltaVivino = ratingDelta(wine.vivino, wine.kimiVivino);
  const hasKimi =
    wine.kimiCheckedAt != null ||
    wine.kimiVivino != null ||
    wine.kimiPrice != null ||
    Boolean(wine.kimiSummary);

  return (
    <div className="min-w-0 overflow-hidden">
      {onBack ? (
        <button
          type="button"
          className="mobile-only mb-3 text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          onClick={onBack}
        >
          ← {backLabel}
        </button>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft sm:text-xs">
            Detalle
          </p>
          <h2 className="display mt-2 text-[1.85rem] leading-tight text-ink sm:text-3xl">
            {wine.name}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {wine.winery || "Bodega sin registrar"} · {wine.vintage ?? "s/a"}
          </p>
        </div>
        <CountryFlag country={wine.country} size="lg" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
        <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--line)] px-2.5 py-1.5 text-xs text-ink">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: typeAccent(wine.type) }}
          />
          {wine.type}
        </span>
        <span className="rounded-[8px] border border-[var(--line)] px-2.5 py-1.5 text-xs text-ink">
          Vivino {formatVivino(wine.vivino)}
        </span>
        <span className="rounded-[8px] border border-[var(--line)] px-2.5 py-1.5 text-xs text-ink">
          {formatPrice(wine.price)}
        </span>
        {wine.externalRating != null ? (
          <span className="rounded-[8px] border border-[rgba(110,31,44,0.28)] bg-[rgba(110,31,44,0.06)] px-2.5 py-1.5 text-xs text-ink">
            Verificado {formatVivino(wine.externalRating)}
            {delta != null && delta !== 0 ? (
              <span className="text-ink-soft">
                {" "}
                ({delta > 0 ? "+" : ""}
                {delta.toFixed(1)})
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

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
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          Maridaje sugerido
        </p>
        <p className="mt-1 text-xs text-ink-soft">{pairing.note}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {pairing.dishes.map((dish) => (
            <li
              key={dish}
              className="rounded-[8px] border border-[var(--line)] bg-[rgba(255,252,247,0.7)] px-2.5 py-1.5 text-xs text-ink"
            >
              {dish}
            </li>
          ))}
        </ul>
      </div>

      {onSaveKimiResearch ? (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Investigación Kimi
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Última consulta: {formatCheckedAt(wine.kimiCheckedAt)}
                {wine.kimiConfidence
                  ? ` · ${confidenceLabel[wine.kimiConfidence]}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost min-h-[40px] px-3 text-sm disabled:opacity-60"
              disabled={kimiLoading}
              onClick={() => void handleKimiResearch()}
            >
              {kimiLoading
                ? "Consultando…"
                : hasKimi
                  ? "Actualizar"
                  : "Consultar"}
            </button>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-ink-soft">
            Estimación por conocimiento de la IA (no es Vivino en vivo). Úsala
            para contrastar tu calificación y precio guardados.
          </p>

          {kimiError ? (
            <p className="mt-2 text-sm text-[var(--wine)]">{kimiError}</p>
          ) : null}

          {hasKimi ? (
            <div className="mt-3 space-y-3 rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Vivino estimado
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {formatVivino(wine.kimiVivino)}
                    <span className="text-ink-soft">
                      {" "}
                      · tuyo {formatVivino(wine.vivino)}
                    </span>
                    {kimiDeltaVivino != null && kimiDeltaVivino !== 0 ? (
                      <span className="text-ink-soft">
                        {" "}
                        ({kimiDeltaVivino > 0 ? "+" : ""}
                        {kimiDeltaVivino.toFixed(1)})
                      </span>
                    ) : null}
                  </p>
                  {onApplyKimiResearch && wine.kimiVivino != null ? (
                    <button
                      type="button"
                      className="mt-2 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => applyKimiToFicha({ vivino: true })}
                    >
                      Usar este Vivino
                    </button>
                  ) : null}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                    Precio estimado
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {formatPrice(wine.kimiPrice)}
                    <span className="text-ink-soft">
                      {" "}
                      · tuyo {formatPrice(wine.price)}
                    </span>
                  </p>
                  {onApplyKimiResearch && wine.kimiPrice != null ? (
                    <button
                      type="button"
                      className="mt-2 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => applyKimiToFicha({ price: true })}
                    >
                      Usar este precio
                    </button>
                  ) : null}
                </div>
              </div>
              {wine.kimiSummary ? (
                <p className="text-sm leading-relaxed text-ink">
                  {wine.kimiSummary}
                </p>
              ) : null}
              {onApplyKimiResearch &&
              (wine.kimiVivino != null || wine.kimiPrice != null) ? (
                <button
                  type="button"
                  className="btn btn-primary min-h-[44px] w-full text-sm"
                  onClick={() =>
                    applyKimiToFicha({
                      vivino: wine.kimiVivino != null,
                      price: wine.kimiPrice != null,
                    })
                  }
                >
                  Aplicar Vivino y precio a mi ficha
                </button>
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

      {onVerifyRating ? (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Rating externo
              </p>
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
                Vivino acierta más si escribes/pegas en su buscador (typeahead)
                que si abres una URL con toda la consulta de golpe. Te abrimos
                Vivino y copiamos el texto.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost min-h-[40px] px-3 text-sm"
                  onClick={() => void openVivinoTypeahead()}
                >
                  Buscar en Vivino ↗
                </button>
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
                <p className="text-xs text-ink">{vivinoHint}</p>
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
                  Actualizar también mi Vivino guardado
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

      {(onOpened || onGifted || onEdit || onRemove) && (
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
                  onClick={() => {
                    if (
                      confirm(
                        `¿Regalaste “${wine.name}”?\nSaldrá del inventario.`
                      )
                    ) {
                      onGifted(wine);
                    }
                  }}
                >
                  La regalé
                </button>
              ) : null}
            </div>
          )}
          {(onEdit || onRemove) && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        Precio y calificación son referencia. Kimi estima; la verificación
        manual con Vivino / Wine-Searcher sigue disponible abajo.
      </p>
    </div>
  );
}
