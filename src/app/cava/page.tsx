"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CellarMap } from "@/components/CellarMap";
import { CellarUnitsBar } from "@/components/CellarUnitsBar";
import { DepartTasteModal } from "@/components/DepartTasteModal";
import { DisplayNameEditor } from "@/components/DisplayNameEditor";
import { FiltersBar } from "@/components/FiltersBar";
import { FirstRunGuide } from "@/components/FirstRunGuide";
import { InstallAppHint } from "@/components/InstallAppHint";
import { KimiUsageHint } from "@/components/KimiUsageHint";
import { MoveWineSheet } from "@/components/MoveWineSheet";
import { NetworkPanel } from "@/components/NetworkPanel";
import { RecentHistory } from "@/components/RecentHistory";
import { ResizableDesktopPanels } from "@/components/ResizableDesktopPanels";
import { StatsDashboard } from "@/components/StatsDashboard";
import { WineDetail } from "@/components/WineDetail";
import { WineFormModal } from "@/components/WineFormModal";
import { WineList } from "@/components/WineList";
import { useCellar } from "@/lib/cellar-store";
import { useAuth } from "@/lib/auth-store";
import { fetchTotalUnread } from "@/lib/network";
import { uploadLabelImage } from "@/lib/label-image";
import {
  buildInviteFriendText,
  shareOrCopyText,
} from "@/lib/share-wine";
import type { DepartAction, DepartExtras, Filters, MatchConfidence, RatingSource, Wine } from "@/lib/types";
import {
  cellarStats,
  filterWines,
  formatPrice,
  formatVivino,
  getEmptySlots,
} from "@/lib/wines";

const initialFilters: Filters = {
  query: "",
  country: "",
  type: "",
  grape: "",
  minVivino: null,
  maxVivino: null,
  minCavatale: null,
  maxCavatale: null,
  minPrice: null,
  maxPrice: null,
  sort: "vivino-desc",
};

type MobilePanel = "mapa" | "lista" | "detalle";
type AppMode = "cava" | "stats" | "network";

export default function CavaPage() {
  const {
    wines,
    history,
    ready,
    canImportLocal,
    cellars,
    activeCellar,
    activeCellarId,
    setActiveCellarId,
    addCellarUnit,
    updateCellarUnit,
    deleteCellarUnit,
    addWine,
    updateWine,
    verifyWineRating,
    saveKimiResearch,
    saveKimiUserNote,
    setLabelImageUrl,
    applyKimiResearch,
    moveWine,
    departWine,
    resetCellar,
    importLocalCellar,
    dismissImportOffer,
    syncError,
    clearSyncError,
    syncOk,
    clearSyncOk,
    isOnline,
  } = useCellar();
  const { signOut, user, configured } = useAuth();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("lista");
  const [mode, setMode] = useState<AppMode>("cava");
  const [networkUnread, setNetworkUnread] = useState(0);
  /** Where to return after leaving Detalle (mapa vs lista). */
  const [detailReturn, setDetailReturn] = useState<MobilePanel>("lista");
  const [formOpen, setFormOpen] = useState(false);
  const [formSlot, setFormSlot] = useState("");
  const [formInitialStep, setFormInitialStep] = useState<"pick" | "form">(
    "pick"
  );
  const [editing, setEditing] = useState<Wine | null>(null);
  const [departWineTarget, setDepartWineTarget] = useState<Wine | null>(null);
  const [departAction, setDepartAction] = useState<DepartAction>("opened");
  const [movingWineId, setMovingWineId] = useState<string | null>(null);
  const [moveSheetWine, setMoveSheetWine] = useState<Wine | null>(null);
  const [inviteHint, setInviteHint] = useState<string | null>(null);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [storyHintDismissed, setStoryHintDismissed] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleVaciarCava() {
    if (clearing) return;
    if (
      !confirm(
        "¿Vaciar SOLO tu cava?\nSe borran las botellas de tu cuenta. La cava de otros usuarios no se toca.\nEsta acción no se puede deshacer."
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await resetCellar();
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    try {
      setGuideDismissed(localStorage.getItem("micava.guide.dismissed.v1") === "1");
      setStoryHintDismissed(
        localStorage.getItem("micava.story.hint.v1") === "1"
      );
    } catch {
      /* ignore */
    }
  }, []);

  // Red tab unread badge (works even when NetworkPanel is unmounted).
  useEffect(() => {
    if (!user || !configured) {
      setNetworkUnread(0);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const total = await fetchTotalUnread();
        if (!cancelled) setNetworkUnread(total);
      } catch {
        if (!cancelled) setNetworkUnread(0);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, configured, mode]);

  function dismissGuide() {
    setGuideDismissed(true);
    setShowHowTo(false);
    try {
      localStorage.setItem("micava.guide.dismissed.v1", "1");
    } catch {
      /* ignore */
    }
  }

  function dismissStoryHint() {
    setStoryHintDismissed(true);
    try {
      localStorage.setItem("micava.story.hint.v1", "1");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!selectedId && wines[0]) setSelectedId(wines[0].id);
    if (selectedId && !wines.some((w) => w.id === selectedId)) {
      setSelectedId(wines[0]?.id ?? null);
    }
  }, [wines, selectedId]);

  const visible = useMemo(() => filterWines(wines, filters), [wines, filters]);
  const selected =
    visible.find((w) => w.id === selectedId) ??
    wines.find((w) => w.id === selectedId) ??
    visible[0] ??
    null;

  const selectedHasStory = Boolean(
    selected?.kimiSummary ||
      selected?.kimiCuriosity ||
      selected?.kimiTalkHook
  );

  /** One-shot next step after the first bottle; not every session forever. */
  const showStoryNext =
    ready &&
    wines.length === 1 &&
    !storyHintDismissed &&
    Boolean(selected) &&
    !selectedHasStory;

  // Persist dismissal once they already have a story for the focus wine.
  useEffect(() => {
    if (!selectedHasStory || storyHintDismissed) return;
    setStoryHintDismissed(true);
    try {
      localStorage.setItem("micava.story.hint.v1", "1");
    } catch {
      /* ignore */
    }
  }, [selectedHasStory, storyHintDismissed]);

  const stats = cellarStats(visible, {
    cols: activeCellar?.cols,
    rows: activeCellar?.rows,
    cellarId: activeCellar?.id ?? null,
  });

  const firstEmptyInActive = useMemo(() => {
    if (!activeCellar) return null;
    return (
      getEmptySlots(
        wines,
        activeCellar.cols,
        activeCellar.rows,
        activeCellar.id
      )[0] ?? null
    );
  }, [activeCellar, wines]);

  function selectWine(
    wine: Wine,
    goToDetail = false,
    from: MobilePanel = "lista"
  ) {
    setSelectedId(wine.id);
    setMode("cava");
    if (wine.cellarId) setActiveCellarId(wine.cellarId);
    if (goToDetail) {
      setDetailReturn(from);
      setMobilePanel("detalle");
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  function leaveDetail() {
    setMobilePanel(detailReturn);
  }

  function openAdd(slot = "", opts?: { step?: "pick" | "form" }) {
    setEditing(null);
    setFormSlot(slot);
    setFormInitialStep(opts?.step ?? "pick");
    setFormOpen(true);
    setMode("cava");
  }

  function handleMoveWine(wineId: string, targetLocation: string) {
    moveWine(wineId, targetLocation, activeCellarId);
  }

  function handlePlaceMovingWine(slot: string) {
    if (!movingWineId) return;
    const destCellar = slot === "abajo" || !slot ? null : activeCellarId;
    moveWine(movingWineId, slot, destCellar);
    setMovingWineId(null);
  }

  function handleMoveSheetConfirm(
    targetLocation: string,
    targetCellarId: string | null
  ) {
    if (!moveSheetWine) return;
    moveWine(moveSheetWine.id, targetLocation, targetCellarId);
    if (targetCellarId) setActiveCellarId(targetCellarId);
    setSelectedId(moveSheetWine.id);
    setMoveSheetWine(null);
    setMovingWineId(null);
  }

  function openEdit(wine: Wine) {
    setEditing(wine);
    setFormSlot("");
    setFormOpen(true);
    setMobilePanel("detalle");
  }

  function handleDepart(
    wine: Wine,
    action: DepartAction,
    extras?: DepartExtras
  ) {
    departWine(wine.id, action, extras);
    setSelectedId((prev) => (prev === wine.id ? null : prev));
    setMobilePanel(detailReturn);
    setDepartWineTarget(null);
  }

  function openDepart(wine: Wine, action: DepartAction) {
    setDepartWineTarget(wine);
    setDepartAction(action);
  }

  async function handleInviteFriend() {
    const result = await shareOrCopyText(
      buildInviteFriendText(),
      "Invitar a Cavatale"
    );
    if (result === "copied") {
      setInviteHint("Copiado");
      window.setTimeout(() => setInviteHint(null), 2000);
    } else if (result === "shared") {
      setInviteHint(null);
    }
  }

  function handleVerifyRating(
    wine: Wine,
    data: {
      externalRating: number;
      ratingSource: RatingSource;
      matchConfidence: MatchConfidence;
      syncVivino: boolean;
    }
  ) {
    verifyWineRating(
      wine.id,
      {
        externalRating: data.externalRating,
        ratingSource: data.ratingSource,
        lastCheckedAt: new Date().toISOString(),
        matchConfidence: data.matchConfidence,
      },
      { syncVivino: data.syncVivino }
    );
  }

  const detailProps = {
    wine: selected,
    onBack: leaveDetail,
    backLabel: detailReturn === "mapa" ? "Volver al mapa" : "Volver a la lista",
    onEdit: openEdit,
    onRemove: (w: Wine) => handleDepart(w, "removed"),
    onOpened: (w: Wine) => openDepart(w, "opened"),
    onGifted: (w: Wine) => openDepart(w, "gifted"),
    onVerifyRating: handleVerifyRating,
    onSaveKimiResearch: (w: Wine, research: Parameters<typeof saveKimiResearch>[1]) =>
      saveKimiResearch(w.id, research),
    onSaveKimiUserNote: (w: Wine, note: string | null) =>
      saveKimiUserNote(w.id, note),
    onApplyKimiResearch: (
      w: Wine,
      fields: { vivino?: boolean; price?: boolean }
    ) => applyKimiResearch(w.id, fields),
    onMove: (w: Wine) => setMoveSheetWine(w),
  };

  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 xl:pb-10">
        {!isOnline ? (
          <div
            role="status"
            className="mb-4 rounded-[10px] border border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] px-3 py-2.5 text-sm text-ink"
          >
            Sin conexión — los cambios se quedan en este dispositivo hasta que
            vuelvas a la red.
          </div>
        ) : syncError ? (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-3 rounded-[10px] border border-[rgba(110,31,44,0.35)] bg-[rgba(110,31,44,0.08)] px-3 py-2.5 text-sm text-ink"
          >
            <p className="min-w-0 flex-1">{syncError}</p>
            <button
              type="button"
              className="shrink-0 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
              onClick={clearSyncError}
            >
              Cerrar
            </button>
          </div>
        ) : syncOk ? (
          <div
            role="status"
            className="mb-4 flex items-start justify-between gap-3 rounded-[10px] border border-[rgba(62,92,58,0.28)] bg-[rgba(62,92,58,0.08)] px-3 py-2.5 text-sm text-ink"
          >
            <p className="min-w-0 flex-1">{syncOk}</p>
            <button
              type="button"
              className="shrink-0 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
              onClick={clearSyncOk}
            >
              Cerrar
            </button>
          </div>
        ) : null}
        <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <BrandMark size="lg" />
            <DisplayNameEditor />
            <div className="mt-3 inline-flex rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] p-1">
              <button
                type="button"
                className={[
                  "min-h-[36px] rounded-[8px] px-3 text-sm transition",
                  mode === "cava"
                    ? "bg-[rgba(110,31,44,0.12)] font-medium text-ink"
                    : "text-ink-soft",
                ].join(" ")}
                onClick={() => setMode("cava")}
              >
                Cava
              </button>
              <button
                type="button"
                className={[
                  "min-h-[36px] rounded-[8px] px-3 text-sm transition",
                  mode === "stats"
                    ? "bg-[rgba(110,31,44,0.12)] font-medium text-ink"
                    : "text-ink-soft",
                ].join(" ")}
                onClick={() => setMode("stats")}
              >
                Pulso
              </button>
              <button
                type="button"
                className={[
                  "min-h-[36px] rounded-[8px] px-3 text-sm transition",
                  mode === "network"
                    ? "bg-[rgba(110,31,44,0.12)] font-medium text-ink"
                    : "text-ink-soft",
                ].join(" ")}
                onClick={() => setMode("network")}
              >
                <span className="inline-flex items-center gap-1.5">
                  Red
                  {networkUnread > 0 ? (
                    <span
                      className="inline-flex min-w-[1.25rem] items-center justify-center rounded-[8px] bg-[var(--wine)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[rgba(255,252,247,0.96)]"
                      aria-label={`${networkUnread} mensajes no leídos`}
                    >
                      {networkUnread > 99 ? "99+" : networkUnread}
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            <span>
              <strong className="text-ink">{stats.bottles}</strong> botellas
            </span>
            <span>
              <strong className="text-ink">{formatPrice(stats.value)}</strong> ref.
            </span>
            <span>
              calif. Vivino{" "}
              <strong className="text-ink">{formatVivino(stats.avgVivino)}</strong>
            </span>
            <button
              type="button"
              className="btn btn-primary min-h-[40px] px-3 text-sm"
              onClick={() => openAdd()}
            >
              + Agregar
            </button>
            <button
              type="button"
              className="btn btn-ghost min-h-[40px] px-3 text-sm"
              onClick={() => void handleInviteFriend()}
            >
              {inviteHint ?? "Invitar"}
            </button>
            <button
              type="button"
              className="min-h-[40px] text-sm underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setShowHowTo(true)}
            >
              Cómo funciona
            </button>
            <button
              type="button"
              className="min-h-[40px] text-sm underline-offset-2 hover:text-ink hover:underline"
              onClick={() => {
                void signOut().then(() => {
                  window.location.href = "/";
                });
              }}
            >
              Salir
            </button>
          </div>
        </header>

        <InstallAppHint />

        {!configured ? (
          <div className="mt-4 rounded-[12px] border border-[var(--line)] bg-[rgba(255,252,247,0.7)] p-4 text-sm text-ink">
            <p className="font-medium">Falta conectar Supabase</p>
            <p className="mt-1 text-ink-soft">
              Crea un proyecto gratis, ejecuta{" "}
              <code className="text-ink">supabase/schema.sql</code> y añade{" "}
              <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
              <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en
              Vercel / <code className="text-ink">.env.local</code>.
            </p>
          </div>
        ) : null}

        {canImportLocal ? (
          <div className="mt-4 rounded-[12px] border border-[rgba(110,31,44,0.25)] bg-[rgba(110,31,44,0.06)] p-4 text-sm text-ink">
            <p className="font-medium">Hay botellas guardadas en este teléfono/navegador.</p>
            <p className="mt-1 text-ink-soft">
              Solo impórtalas si son tuyas. Si es la cava de otra persona en el
              mismo dispositivo, toca “Ahora no”.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary min-h-[40px] px-3 text-sm"
                onClick={() => void importLocalCellar()}
              >
                Importar a mi cuenta
              </button>
              <button
                type="button"
                className="btn btn-ghost min-h-[40px] px-3 text-sm"
                onClick={dismissImportOffer}
              >
                Ahora no
              </button>
            </div>
          </div>
        ) : null}

        {/* Keep out of document flow — an in-flow "Cargando…" shifts the whole page when ready flips. */}
        {!ready ? (
          <p className="sr-only" aria-live="polite">
            Cargando tu cava…
          </p>
        ) : null}

        {mode === "network" ? (
          <div className="mt-6">
            <NetworkPanel onUnreadTotalChange={setNetworkUnread} />
          </div>
        ) : mode === "stats" ? (
          <div className="mt-6 space-y-5">
            <RecentHistory entries={history} />
            <StatsDashboard
              wines={wines}
              cellars={cellars}
              history={history}
              onSelectWine={(w) => selectWine(w, true, "lista")}
            />
          </div>
        ) : wines.length === 0 && ready ? (
          <div className="space-y-6">
            {showHowTo ? (
              <div className="mt-5">
                <FirstRunGuide
                  onScan={() => {
                    setShowHowTo(false);
                    openAdd();
                  }}
                  onManual={() => {
                    setShowHowTo(false);
                    openAdd("", { step: "form" });
                  }}
                  onDismiss={dismissGuide}
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-ink-soft underline-offset-2 hover:underline"
                  onClick={() => setShowHowTo(false)}
                >
                  Cerrar guía
                </button>
              </div>
            ) : (
              <FirstRunGuide
                onScan={() => openAdd()}
                onManual={() => openAdd("", { step: "form" })}
              />
            )}

            <div className="space-y-4">
              <CellarUnitsBar
                cellars={cellars}
                wines={wines}
                activeId={activeCellar?.id ?? null}
                onSelect={setActiveCellarId}
                onAdd={addCellarUnit}
                onUpdate={updateCellarUnit}
                onDelete={deleteCellarUnit}
              />
              <section className="panel p-3 sm:p-5">
                <div className="mb-3 flex items-baseline justify-between gap-3 sm:mb-4">
                  <h2 className="display text-xl text-ink sm:text-2xl">
                    {activeCellar ? activeCellar.name : "Mapa de la cava"}
                  </h2>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft sm:text-xs">
                    Toca + para sumar
                  </p>
                </div>
                {activeCellar ? (
                  <CellarMap
                    wines={wines}
                    cols={activeCellar.cols}
                    rows={activeCellar.rows}
                    cellarId={activeCellar.id}
                    title={activeCellar.name}
                    highlightedIds={new Set()}
                    selectedId={null}
                    onSelect={() => {}}
                    onEmptySlot={(slot) => openAdd(slot)}
                  />
                ) : (
                  <p className="text-sm text-ink-soft">
                    Crea un mueble para empezar a acomodar botellas.
                  </p>
                )}
              </section>
            </div>
          </div>
        ) : (
          <>
        {showHowTo ? (
          <div className="mt-5">
            <FirstRunGuide
              onScan={() => {
                setShowHowTo(false);
                openAdd();
              }}
              onManual={() => {
                setShowHowTo(false);
                openAdd("", { step: "form" });
              }}
              onDismiss={dismissGuide}
            />
            <button
              type="button"
              className="mt-2 text-xs text-ink-soft underline-offset-2 hover:underline"
              onClick={dismissGuide}
            >
              Cerrar guía
            </button>
          </div>
        ) : showStoryNext &&
          !(mode === "cava" && mobilePanel === "detalle") ? (
          <FirstRunGuide
            variant="story-next"
            onScan={() => openAdd()}
            onTellStory={() => {
              if (selected) {
                selectWine(
                  selected,
                  true,
                  mobilePanel === "mapa" ? "mapa" : "lista"
                );
              }
            }}
            onDismiss={dismissStoryHint}
          />
        ) : !guideDismissed && wines.length > 0 ? (
          <FirstRunGuide
            variant="compact"
            onScan={() => openAdd()}
            onDismiss={dismissGuide}
          />
        ) : null}
        <div
          className={[
            "mt-5 space-y-4 sm:mt-6",
            mobilePanel === "detalle" ? "hidden xl:block" : "",
          ].join(" ")}
        >
          <CellarUnitsBar
            cellars={cellars}
            wines={wines}
            activeId={activeCellar?.id ?? null}
            onSelect={setActiveCellarId}
            onAdd={addCellarUnit}
            onUpdate={updateCellarUnit}
            onDelete={deleteCellarUnit}
          />
          {movingWineId ? (
            <div className="rounded-[10px] border border-[rgba(110,31,44,0.35)] bg-[rgba(250,249,245,0.96)] px-3 py-2.5">
              <p className="text-sm font-medium text-ink">
                Moviendo ·{" "}
                {wines.find((w) => w.id === movingWineId)?.name ?? "botella"}
              </p>
              <p className="text-xs text-ink-soft">
                Ahora toca el hueco destino en el mapa. Puedes cambiar de mueble
                arriba.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary min-h-[36px] px-3 text-xs disabled:opacity-50"
                  disabled={!firstEmptyInActive}
                  onClick={() => {
                    if (firstEmptyInActive) {
                      handlePlaceMovingWine(firstEmptyInActive);
                    }
                  }}
                >
                  {firstEmptyInActive
                    ? "Ocupar espacio disponible"
                    : "Sin huecos libres"}
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--wine)] underline-offset-2 hover:underline"
                  onClick={() => setMovingWineId(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            total={visible.length}
            wines={wines}
          />
        </div>

        <ResizableDesktopPanels
          map={
            <section className="panel p-5">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="display text-2xl text-ink">
                  {activeCellar ? activeCellar.name : "Mapa de la cava"}
                </h2>
                <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
                  {stats.emptySlots} libres
                </p>
              </div>
              {activeCellar ? (
                <CellarMap
                  wines={wines}
                  cols={activeCellar.cols}
                  rows={activeCellar.rows}
                  cellarId={activeCellar.id}
                  title={activeCellar.name}
                  highlightedIds={new Set(visible.map((w) => w.id))}
                  selectedId={selected?.id ?? null}
                  movingWineId={movingWineId}
                  onSelect={(w) => selectWine(w)}
                  onEmptySlot={(slot) => openAdd(slot)}
                  onMoveWine={handleMoveWine}
                  onPickForMove={(w) => {
                    setMovingWineId(w.id);
                    setSelectedId(w.id);
                    setMobilePanel("mapa");
                  }}
                  onCancelMove={() => setMovingWineId(null)}
                  onPlaceAt={handlePlaceMovingWine}
                />
              ) : (
                <p className="text-sm text-ink-soft">
                  Crea un mueble para empezar a acomodar botellas.
                </p>
              )}
            </section>
          }
          inventory={
            <section className="panel flex min-h-[420px] flex-col p-5">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="display text-2xl text-ink">Inventario</h2>
                <p className="text-sm text-ink-soft">{visible.length}</p>
              </div>
              <WineList
                wines={visible}
                selectedId={selected?.id ?? null}
                onSelect={(w) => selectWine(w)}
                inventoryCount={wines.length}
              />
            </section>
          }
          detail={
            <section className="panel min-w-0 overflow-hidden p-5">
              <WineDetail {...detailProps} />
            </section>
          }
        />

        <div className="mobile-only mt-5">
          {mobilePanel === "mapa" && (
            <section className="panel p-3 sm:p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="display text-xl text-ink sm:text-2xl">
                  {activeCellar ? activeCellar.name : "Mapa"}
                </h2>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft sm:text-xs">
                  + en huecos
                </p>
              </div>
              {activeCellar ? (
                <CellarMap
                  wines={wines}
                  cols={activeCellar.cols}
                  rows={activeCellar.rows}
                  cellarId={activeCellar.id}
                  title={activeCellar.name}
                  highlightedIds={new Set(visible.map((w) => w.id))}
                  selectedId={selected?.id ?? null}
                  movingWineId={movingWineId}
                  onSelect={(w) => selectWine(w, true, "mapa")}
                  onEmptySlot={(slot) => openAdd(slot)}
                  onMoveWine={handleMoveWine}
                  onPickForMove={(w) => {
                    setMovingWineId(w.id);
                    setSelectedId(w.id);
                  }}
                  onCancelMove={() => setMovingWineId(null)}
                  onPlaceAt={handlePlaceMovingWine}
                />
              ) : (
                <p className="text-sm text-ink-soft">
                  Crea un mueble para ver su rejilla.
                </p>
              )}
            </section>
          )}

          {mobilePanel === "lista" && (
            <section className="panel flex flex-col p-3 sm:p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="display text-xl text-ink sm:text-2xl">Inventario</h2>
                <p className="text-sm text-ink-soft">{visible.length}</p>
              </div>
              <WineList
                wines={visible}
                selectedId={selected?.id ?? null}
                onSelect={(w) => selectWine(w, true, "lista")}
                compact
                inventoryCount={wines.length}
              />
            </section>
          )}

          {mobilePanel === "detalle" && (
            <section
              className="panel mobile-detail-sheet p-0"
              aria-label="Detalle de botella"
            >
              <div className="mobile-detail-sheet__bar">
                <button
                  type="button"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-[10px] px-2 text-sm font-medium text-ink"
                  onClick={leaveDetail}
                >
                  <span aria-hidden className="text-base leading-none">
                    ←
                  </span>
                  <span>
                    {detailReturn === "mapa"
                      ? "Volver al mapa"
                      : "Volver a la lista"}
                  </span>
                </button>
              </div>
              <div className="mobile-detail-sheet__body">
                <WineDetail {...detailProps} embeddedInSheet />
              </div>
            </section>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-soft xl:mt-6">
          {wines.length > 0 ? (
            <button
              type="button"
              className="underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
              disabled={clearing}
              onClick={() => void handleVaciarCava()}
            >
              {clearing ? "Vaciando…" : "Vaciar cava"}
            </button>
          ) : null}
          <span>
            {user?.email
              ? `Guardado en la nube · ${user.email}`
              : "Los cambios se guardan en la nube."}
          </span>
          {user ? <KimiUsageHint /> : null}
        </div>
          </>
        )}

        <nav className="mobile-nav" aria-label="Navegación de cava">
          <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">
            {(
              [
                ["lista", "Lista", "cava"],
                ["mapa", "Mapa", "cava"],
                ["detalle", "Detalle", "cava"],
                ["network", "Red", "network"],
                ["stats", "Pulso", "stats"],
              ] as const
            ).map(([id, label, targetMode]) => (
              <button
                key={id}
                type="button"
                className="mobile-nav-btn"
                aria-current={
                  targetMode === "stats"
                    ? mode === "stats"
                      ? "page"
                      : undefined
                    : targetMode === "network"
                      ? mode === "network"
                        ? "page"
                        : undefined
                      : mode === "cava" && mobilePanel === id
                        ? "page"
                        : undefined
                }
                onClick={() => {
                  if (targetMode === "stats") setMode("stats");
                  else if (targetMode === "network") setMode("network");
                  else if (wines.length === 0) {
                    setMode("cava");
                    if (id === "detalle") openAdd();
                  } else {
                    setMode("cava");
                    setMobilePanel(id as MobilePanel);
                  }
                }}
              >
                <span className="inline-flex flex-col items-center gap-0.5">
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {id === "network" && networkUnread > 0 ? (
                      <span
                        className="inline-flex min-w-[1.1rem] items-center justify-center rounded-[6px] bg-[var(--wine)] px-1 py-0.5 text-[9px] font-medium leading-none text-[rgba(255,252,247,0.96)]"
                        aria-label={`${networkUnread} mensajes no leídos`}
                      >
                        {networkUnread > 99 ? "99+" : networkUnread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      <WineFormModal
        open={formOpen}
        wines={wines}
        cellars={cellars}
        activeCellarId={activeCellar?.id ?? null}
        initialSlot={formSlot}
        initialStep={formInitialStep}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setFormSlot("");
          setFormInitialStep("pick");
        }}
        onSubmit={(draft, extras) => {
          void (async () => {
            let wineId: string;
            if (editing) {
              updateWine(editing.id, draft);
              wineId = editing.id;
              setSelectedId(editing.id);
            } else {
              const created = addWine(draft);
              wineId = created.id;
              setSelectedId(created.id);
              if (!formSlot) setMobilePanel("detalle");
            }

            const dataUrl = extras?.labelImageDataUrl;
            if (dataUrl && user?.id) {
              try {
                const path = await uploadLabelImage(user.id, wineId, dataUrl);
                setLabelImageUrl(wineId, path);
              } catch {
                // Wine is saved; label upload can fail if storage isn't migrated yet.
              }
            }
          })();
        }}
      />

      <DepartTasteModal
        open={Boolean(departWineTarget)}
        wine={departWineTarget}
        action={departAction}
        onClose={() => setDepartWineTarget(null)}
        onSaveDiscovery={(w, research) => saveKimiResearch(w.id, research)}
        onConfirm={(extras) => {
          if (!departWineTarget) return;
          handleDepart(departWineTarget, departAction, extras);
        }}
      />

      {moveSheetWine ? (
        <MoveWineSheet
          wine={moveSheetWine}
          cellars={cellars}
          wines={wines}
          onClose={() => setMoveSheetWine(null)}
          onConfirm={handleMoveSheetConfirm}
        />
      ) : null}
    </main>
  );
}
