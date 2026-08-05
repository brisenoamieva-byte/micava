"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BitacoraPanel } from "@/components/BitacoraPanel";
import { CellarMap } from "@/components/CellarMap";
import { CellarUnitsBar } from "@/components/CellarUnitsBar";
import { DepartTasteModal } from "@/components/DepartTasteModal";
import { DisplayNameEditor } from "@/components/DisplayNameEditor";
import { EncuentroModal } from "@/components/EncuentroModal";
import { FiltersBar } from "@/components/FiltersBar";
import { FirstRunGuide } from "@/components/FirstRunGuide";
import { InstallAppHint } from "@/components/InstallAppHint";
import { KimiUsageHint } from "@/components/KimiUsageHint";
import { MoveWineSheet } from "@/components/MoveWineSheet";
import { RecentHistory } from "@/components/RecentHistory";
import { ResizableDesktopPanels } from "@/components/ResizableDesktopPanels";
import { ShareCavaModal } from "@/components/ShareCavaModal";
import { StatsDashboard } from "@/components/StatsDashboard";
import { WineDetail } from "@/components/WineDetail";
import { WineFormModal } from "@/components/WineFormModal";
import { WineList } from "@/components/WineList";
import { useCellar } from "@/lib/cellar-store";
import { useAuth } from "@/lib/auth-store";
import { useT } from "@/lib/i18n";
import { uploadLabelImage } from "@/lib/label-image";
import {
  buildInviteFriendText,
  shareOrCopyText,
} from "@/lib/share-wine";
import type {
  DepartAction,
  DepartExtras,
  Filters,
  Wine,
  WineDraft,
} from "@/lib/types";
import {
  cellarStats,
  filterWines,
  formatCavataleRating,
  getEmptySlots,
} from "@/lib/wines";

const initialFilters: Filters = {
  query: "",
  country: "",
  type: "",
  grape: "",
  minCavatale: null,
  maxCavatale: null,
  minPrice: null,
  maxPrice: null,
  sort: "cavatale-desc",
};

type MobilePanel = "mapa" | "lista" | "detalle";
type AppMode = "cava" | "stats";

export default function CavaPage() {
  const {
    wines,
    history,
    encounters,
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
    saveKimiResearch,
    saveKimiUserNote,
    setLabelImageUrl,
    applyKimiResearch,
    saveVerifiedPrice,
    moveWine,
    departWine,
    saveEncounter,
    removeEncounter,
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
  const t = useT();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("lista");
  const [mode, setMode] = useState<AppMode>("cava");
  /** Where to return after leaving Detalle (mapa vs lista). */
  const [detailReturn, setDetailReturn] = useState<MobilePanel>("lista");
  const [formOpen, setFormOpen] = useState(false);
  const [formSlot, setFormSlot] = useState("");
  const [formInitialStep, setFormInitialStep] = useState<"pick" | "form">(
    "pick"
  );
  const [formPrefill, setFormPrefill] = useState<WineDraft | null>(null);
  const [encuentroOpen, setEncuentroOpen] = useState(false);
  const [editing, setEditing] = useState<Wine | null>(null);
  const [departWineTarget, setDepartWineTarget] = useState<Wine | null>(null);
  const [departAction, setDepartAction] = useState<DepartAction>("opened");
  const [movingWineId, setMovingWineId] = useState<string | null>(null);
  const [moveSheetWine, setMoveSheetWine] = useState<Wine | null>(null);
  const [inviteHint, setInviteHint] = useState<string | null>(null);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [storyHintDismissed, setStoryHintDismissed] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [shareCavaOpen, setShareCavaOpen] = useState(false);
  const [shareNudgeDismissed, setShareNudgeDismissed] = useState(true);
  const [clearing, setClearing] = useState(false);

  async function handleVaciarCava() {
    if (clearing) return;
    if (!confirm(t("cava.clearConfirm"))) {
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
      setShareNudgeDismissed(
        localStorage.getItem("micava.share.nudge.v1") === "1"
      );
    } catch {
      /* ignore */
    }
  }, []);

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

  function dismissShareNudge() {
    setShareNudgeDismissed(true);
    try {
      localStorage.setItem("micava.share.nudge.v1", "1");
    } catch {
      /* ignore */
    }
  }

  function openShareCava() {
    dismissShareNudge();
    setShareCavaOpen(true);
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

  /** Soft prompt once the cava has a few bottles — share stays in Más / nudge. */
  const showShareNudge =
    ready &&
    Boolean(user) &&
    wines.length >= 3 &&
    !shareNudgeDismissed &&
    !showStoryNext;

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

  function openAdd(slot = "", opts?: { step?: "pick" | "form"; prefill?: WineDraft | null }) {
    setEditing(null);
    setFormSlot(slot);
    setFormInitialStep(opts?.step ?? "pick");
    setFormPrefill(opts?.prefill ?? null);
    setFormOpen(true);
    setMode("cava");
  }

  function openEncuentro() {
    setEncuentroOpen(true);
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
      t("cava.inviteShareTitle")
    );
    if (result === "copied") {
      setInviteHint(t("common.copied"));
      window.setTimeout(() => setInviteHint(null), 2000);
    } else if (result === "shared") {
      setInviteHint(null);
    }
  }

  const detailProps = {
    wine: selected,
    onBack: leaveDetail,
    backLabel:
      detailReturn === "mapa" ? t("cava.backToMap") : t("cava.backToList"),
    onEdit: openEdit,
    onRemove: (w: Wine) => handleDepart(w, "removed"),
    onOpened: (w: Wine) => openDepart(w, "opened"),
    onSaveKimiResearch: (w: Wine, research: Parameters<typeof saveKimiResearch>[1]) =>
      saveKimiResearch(w.id, research),
    onSaveKimiUserNote: (w: Wine, note: string | null) =>
      saveKimiUserNote(w.id, note),
    onApplyKimiResearch: (
      w: Wine,
      fields: { vivino?: boolean; price?: boolean }
    ) => applyKimiResearch(w.id, fields),
    onSaveVerifiedPrice: (
      w: Wine,
      result: { amount: number; currency: string }
    ) => saveVerifiedPrice(w.id, result),
    onMove: (w: Wine) => setMoveSheetWine(w),
  };

  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      {showHowTo ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t("cava.howItWorks")}
        >
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(26,23,20,0.45)]"
            aria-label={t("common.close")}
            onClick={() => setShowHowTo(false)}
          />
          <div className="panel-focus relative z-10 max-h-[min(88dvh,720px)] w-full max-w-lg overflow-y-auto p-5 sm:p-6">
            <FirstRunGuide
              onScan={() => {
                setShowHowTo(false);
                openAdd();
              }}
              onManual={() => {
                setShowHowTo(false);
                openAdd("", { step: "form" });
              }}
              onDismiss={() => setShowHowTo(false)}
            />
            <button
              type="button"
              className="mt-4 w-full min-h-[44px] text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setShowHowTo(false)}
            >
              {t("guide.closeGuide")}
            </button>
          </div>
        </div>
      ) : null}
      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 xl:pb-6">
        {!isOnline ? (
          <div
            role="status"
            className="mb-4 rounded-[10px] border border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] px-3 py-2.5 text-sm text-ink"
          >
            {t("cava.offlineBanner")}
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
              {t("common.close")}
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
              {t("common.close")}
            </button>
          </div>
        ) : null}
        <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <BrandMark size="md" />
            <DisplayNameEditor />
            {/* Desktop only — mobile uses bottom nav for Cava/Pulso */}
            <div className="mt-3 hidden xl:inline-flex rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] p-1">
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
                {t("cava.title")}
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
                {t("cava.pulse")}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-soft">
            {ready ? (
              <>
                <span>
                  <strong className="text-ink">{stats.bottles}</strong>{" "}
                  {t("common.bottles")}
                </span>
                <span className="hidden sm:inline">
                  Cavatale{" "}
                  <strong className="text-ink">
                    {formatCavataleRating(stats.avgCavatale)}
                  </strong>
                </span>
              </>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-2">
              <LanguageSwitcher compact />
              <button
                type="button"
                className="btn btn-primary min-h-[40px] px-3 text-sm"
                onClick={() => openAdd()}
              >
                + {t("cava.add")}
              </button>
              <button
                type="button"
                className="btn btn-ghost min-h-[40px] px-3 text-sm"
                onClick={openEncuentro}
                title={t("cava.scanTitle")}
              >
                {t("cava.scanBottle")}
              </button>
              <details className="relative">
                <summary className="flex min-h-[40px] cursor-pointer list-none items-center px-1 text-sm underline-offset-2 hover:text-ink hover:underline [&::-webkit-details-marker]:hidden">
                  {t("common.more")}
                </summary>
                <div className="absolute right-0 z-20 mt-1 min-w-[10.5rem] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.98)] p-1.5 shadow-sm backdrop-blur-sm">
                  <button
                    type="button"
                    className="flex w-full min-h-[40px] items-center rounded-[8px] px-3 text-left text-sm text-ink hover:bg-[rgba(110,31,44,0.06)]"
                    onClick={() => {
                      setMode("stats");
                      window.requestAnimationFrame(() => {
                        document
                          .getElementById("bitacora")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                  >
                    {t("cava.bitacora")}
                  </button>
                  {user ? (
                    <button
                      type="button"
                      className="flex w-full min-h-[40px] items-center rounded-[8px] px-3 text-left text-sm text-ink hover:bg-[rgba(110,31,44,0.06)]"
                      onClick={openShareCava}
                    >
                      {t("cava.shareCava")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="flex w-full min-h-[40px] items-center rounded-[8px] px-3 text-left text-sm text-ink hover:bg-[rgba(110,31,44,0.06)]"
                    onClick={() => void handleInviteFriend()}
                  >
                    {inviteHint ?? t("cava.invite")}
                  </button>
                  <button
                    type="button"
                    className="flex w-full min-h-[40px] items-center rounded-[8px] px-3 text-left text-sm text-ink hover:bg-[rgba(110,31,44,0.06)]"
                    onClick={() => {
                      setShowHowTo(true);
                      // Close the “Más” details menu if open
                      const details = document.activeElement?.closest("details");
                      if (details) details.removeAttribute("open");
                    }}
                  >
                    {t("cava.howItWorks")}
                  </button>
                  <button
                    type="button"
                    className="flex w-full min-h-[40px] items-center rounded-[8px] px-3 text-left text-sm text-ink hover:bg-[rgba(110,31,44,0.06)]"
                    onClick={() => {
                      void signOut().then(() => {
                        window.location.href = "/";
                      });
                    }}
                  >
                    {t("cava.signOut")}
                  </button>
                </div>
              </details>
            </div>
          </div>
        </header>

        <InstallAppHint />

        {showShareNudge ? (
          <div className="mt-4 rounded-[12px] border border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] p-4 text-sm text-ink">
            <p className="font-medium">{t("cava.shareNudgeTitle")}</p>
            <p className="mt-1 text-ink-soft">{t("cava.shareNudgeBody")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary min-h-[40px] px-3 text-sm"
                onClick={openShareCava}
              >
                {t("cava.shareCava")}
              </button>
              <button
                type="button"
                className="btn btn-ghost min-h-[40px] px-3 text-sm"
                onClick={dismissShareNudge}
              >
                {t("cava.shareNudgeLater")}
              </button>
            </div>
          </div>
        ) : null}

        {!configured ? (
          <div className="mt-4 rounded-[12px] border border-[var(--line)] bg-[rgba(255,252,247,0.7)] p-4 text-sm text-ink">
            <p className="font-medium">{t("cava.missingSupabaseTitle")}</p>
            <p className="mt-1 text-ink-soft">
              {t("cava.missingSupabaseSetupBody")}
            </p>
          </div>
        ) : null}

        {canImportLocal ? (
          <div className="mt-4 rounded-[12px] border border-[rgba(110,31,44,0.25)] bg-[rgba(110,31,44,0.06)] p-4 text-sm text-ink">
            <p className="font-medium">{t("cava.localBottlesTitle")}</p>
            <p className="mt-1 text-ink-soft">{t("cava.localImportBody")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary min-h-[40px] px-3 text-sm"
                onClick={() => void importLocalCellar()}
              >
                {t("cava.importToAccount")}
              </button>
              <button
                type="button"
                className="btn btn-ghost min-h-[40px] px-3 text-sm"
                onClick={dismissImportOffer}
              >
                {t("cava.shareNudgeLater")}
              </button>
            </div>
          </div>
        ) : null}

        {/* Keep out of document flow — an in-flow "Cargando…" shifts the whole page when ready flips. */}
        {!ready ? (
          <p className="sr-only" aria-live="polite">
            {t("cava.loading")}
          </p>
        ) : null}

        {mode === "stats" ? (
          <div className="mt-6 space-y-5">
            <div id="bitacora">
              <BitacoraPanel
                entries={encounters}
                onRemove={removeEncounter}
              />
            </div>
            <RecentHistory entries={history} />
            <StatsDashboard
              wines={wines}
              cellars={cellars}
              history={history}
              onSelectWine={(w) => selectWine(w, true, "lista")}
            />
          </div>
        ) : !ready ? (
          <div className="mt-6 space-y-4" aria-busy="true" aria-live="polite">
            <p className="flex items-center gap-2 text-sm text-ink-soft">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--wine-soft)]" />
              {t("cava.loading")}
            </p>
            <div className="h-10 animate-pulse rounded-[10px] bg-[rgba(110,31,44,0.06)]" />
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="h-[280px] animate-pulse rounded-[14px] bg-[rgba(110,31,44,0.05)]" />
              <div className="h-[280px] animate-pulse rounded-[14px] bg-[rgba(110,31,44,0.05)]" />
            </div>
          </div>
        ) : wines.length === 0 ? (
          <div className="space-y-6">
            <FirstRunGuide
              onScan={() => openAdd()}
              onManual={() => openAdd("", { step: "form" })}
            />

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
              <section className="panel-focus p-3 sm:p-5">
                <div className="mb-3 flex items-baseline justify-between gap-3 sm:mb-4">
                  <h2 className="display text-xl text-ink sm:text-2xl">
                    {activeCellar ? activeCellar.name : t("cava.cellarMap")}
                  </h2>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft sm:text-xs">
                    {t("cava.tapToAdd")}
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
                    {t("cava.createUnitHint")}
                  </p>
                )}
              </section>
            </div>
          </div>
        ) : (
          <>
        {showStoryNext &&
          !(mode === "cava" && mobilePanel === "detalle") ? (
          <div className="shrink-0">
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
          </div>
        ) : !guideDismissed && wines.length > 0 ? (
          <div className="shrink-0">
            <FirstRunGuide
              variant="compact"
              onScan={() => openAdd()}
              onDismiss={dismissGuide}
            />
          </div>
        ) : null}
        <div
          className={[
            "mt-5 shrink-0 space-y-4 sm:mt-6",
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
                {t("cava.moving")} ·{" "}
                {wines.find((w) => w.id === movingWineId)?.name ??
                  t("common.bottle")}
              </p>
              <p className="text-xs text-ink-soft">{t("cava.movingHint")}</p>
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
                    ? t("cava.occupySlot")
                    : t("cava.noEmptySlots")}
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--wine)] underline-offset-2 hover:underline"
                  onClick={() => setMovingWineId(null)}
                >
                  {t("common.cancel")}
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

        <div className="flex flex-col">
        <ResizableDesktopPanels
          map={
            <section className="panel-focus p-5">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="display text-2xl text-ink">
                  {activeCellar ? activeCellar.name : t("cava.cellarMap")}
                </h2>
                <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
                  {t("cava.freeSlots", { count: stats.emptySlots })}
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
                  {t("cava.createUnitHint")}
                </p>
              )}
            </section>
          }
          inventory={
            <section className="panel-quiet flex h-full min-h-0 flex-col overflow-hidden p-5">
              <div className="mb-4 flex shrink-0 items-baseline justify-between gap-3">
                <h2 className="display text-2xl text-ink">{t("cava.inventory")}</h2>
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
            <section className="panel-focus min-w-0 p-5">
              <WineDetail {...detailProps} />
            </section>
          }
        />

        <div className="mobile-only mt-5 shrink-0">
          {mobilePanel === "mapa" && (
            <section className="panel-focus p-3 sm:p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="display text-xl text-ink sm:text-2xl">
                  {activeCellar ? activeCellar.name : t("cava.map")}
                </h2>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft sm:text-xs">
                  {t("cava.tapSlotsHint")}
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
                  {t("cava.createUnitGridHint")}
                </p>
              )}
            </section>
          )}

          {mobilePanel === "lista" && (
            <section className="panel-quiet flex flex-col p-3 sm:p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="display text-xl text-ink sm:text-2xl">
                  {t("cava.inventory")}
                </h2>
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
              className="panel-focus mobile-detail-sheet p-0"
              aria-label={t("cava.bottleDetail")}
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
                      ? t("cava.backToMap")
                      : t("cava.backToList")}
                  </span>
                </button>
              </div>
              <div className="mobile-detail-sheet__body">
                <WineDetail {...detailProps} embeddedInSheet />
              </div>
            </section>
          )}
        </div>
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap items-center gap-3 text-xs text-ink-soft xl:mt-3">
          {wines.length > 0 ? (
            <button
              type="button"
              className="underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
              disabled={clearing}
              onClick={() => void handleVaciarCava()}
            >
              {clearing ? t("cava.clearing") : t("cava.clearCellar")}
            </button>
          ) : null}
          <span>
            {user?.email
              ? t("cava.savedCloudEmail", { email: user.email })
              : t("cava.savedCloud")}
          </span>
          {user ? <KimiUsageHint /> : null}
        </div>
          </>
        )}

        <nav className="mobile-nav" aria-label={t("cava.navLabel")}>
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-0.5">
            {(
              [
                ["lista", t("cava.list"), "cava"],
                ["mapa", t("cava.map"), "cava"],
                ["detalle", t("cava.detail"), "cava"],
                ["stats", t("cava.pulse"), "stats"],
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
                    : mode === "cava" && mobilePanel === id
                      ? "page"
                      : undefined
                }
                onClick={() => {
                  if (targetMode === "stats") setMode("stats");
                  else if (wines.length === 0) {
                    setMode("cava");
                    if (id === "detalle") openAdd();
                  } else {
                    setMode("cava");
                    setMobilePanel(id as MobilePanel);
                  }
                }}
              >
                <span>{label}</span>
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
        prefillDraft={formPrefill}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setFormSlot("");
          setFormInitialStep("pick");
          setFormPrefill(null);
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

      <EncuentroModal
        open={encuentroOpen}
        onClose={() => setEncuentroOpen(false)}
        onSave={(entry) => {
          saveEncounter(entry);
        }}
        onAlsoAddToCava={(draft) => {
          setEncuentroOpen(false);
          openAdd("", { step: "form", prefill: draft });
        }}
      />

      <ShareCavaModal
        open={shareCavaOpen}
        onClose={() => setShareCavaOpen(false)}
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
