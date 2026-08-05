"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Wine } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import {
  countryDisplayName,
  formatCavataleRating,
  getEmptySlots,
  getWineBySlot,
  typeAccent,
} from "@/lib/wines";
import { CountryFlag } from "@/components/CountryFlag";

type Props = {
  wines: Wine[];
  cols: number;
  rows: string[];
  cellarId: string | null;
  highlightedIds: Set<string>;
  selectedId: string | null;
  /** Shown in the fullscreen overlay header. */
  title?: string;
  /** Wine currently being relocated (pick-and-place; survives mueble switch). */
  movingWineId?: string | null;
  onSelect: (wine: Wine) => void;
  onEmptySlot?: (slot: string) => void;
  /** Desktop HTML5 drag within the active mueble. */
  onMoveWine?: (wineId: string, targetLocation: string) => void;
  onPickForMove?: (wine: Wine) => void;
  onCancelMove?: () => void;
  onPlaceAt?: (slot: string) => void;
};

const DRAG_MIME = "application/x-micava-wine";
const MOVE_THRESHOLD_PX = 12;
/** Hold to enter pick-and-place (scroll stays free). */
const LONG_PRESS_MS = 280;
const MOVE_HINT_KEY = "micava.map.move.hint.v1";

function cellLabel(wine: Wine): string {
  const name = wine.name.trim();
  if (name.length <= 13) return name;
  const words = name.split(/\s+/).filter(Boolean);
  if (words[0] && words[0].length >= 4 && words[0].length <= 13) {
    return words[0];
  }
  return `${name.slice(0, 12)}…`;
}

function cellMeta(wine: Wine): string {
  const bits: string[] = [];
  if (wine.cavataleRating != null) {
    bits.push(formatCavataleRating(wine.cavataleRating));
  } else if (wine.vintage != null) {
    bits.push(String(wine.vintage));
  } else if (wine.type) {
    bits.push(wine.type.slice(0, 3));
  }
  return bits[0] ?? "";
}

function useTouchMoveUi() {
  const [touchUi, setTouchUi] = useState(() => {
    if (typeof window === "undefined") return true;
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches
    );
  });
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const noHover = window.matchMedia("(hover: none)");
    const sync = () => setTouchUi(coarse.matches || noHover.matches);
    sync();
    coarse.addEventListener("change", sync);
    noHover.addEventListener("change", sync);
    return () => {
      coarse.removeEventListener("change", sync);
      noHover.removeEventListener("change", sync);
    };
  }, []);
  return touchUi;
}

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.75;
const BASE_CELL_PX = 58;
const LABEL_COL_PX = 22;

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(z.toFixed(3))));
}

function readIsLandscape(): boolean {
  if (typeof window === "undefined") return false;
  const width = Math.round(
    window.visualViewport?.width ?? window.innerWidth ?? 0
  );
  const height = Math.round(
    window.visualViewport?.height ?? window.innerHeight ?? 0
  );
  if (width > 0 && height > 0 && Math.abs(width - height) >= 16) {
    return width > height;
  }
  const type = window.screen?.orientation?.type;
  if (typeof type === "string") {
    if (type.startsWith("landscape")) return true;
    if (type.startsWith("portrait")) return false;
  }
  try {
    return window.matchMedia("(orientation: landscape)").matches;
  } catch {
    return width > height;
  }
}

async function tryLockLandscape(): Promise<boolean> {
  try {
    const orient = window.screen?.orientation as
      | (ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        })
      | undefined;
    if (!orient || typeof orient.lock !== "function") return false;
    await orient.lock("landscape");
    return true;
  } catch {
    try {
      const orient = window.screen?.orientation as
        | (ScreenOrientation & {
            lock?: (orientation: string) => Promise<void>;
          })
        | undefined;
      await orient?.lock?.("landscape-primary");
      return true;
    } catch {
      return false;
    }
  }
}

function tryUnlockOrientation() {
  try {
    const orient = window.screen?.orientation as
      | (ScreenOrientation & { unlock?: () => void })
      | undefined;
    orient?.unlock?.();
  } catch {
    /* ignore */
  }
}

/** Track real viewport size so Ampliar reflows when the phone rotates. */
function useExpandedViewport(active: boolean) {
  const [box, setBox] = useState(() => ({
    width: 0,
    height: 0,
    landscape: false,
  }));

  useEffect(() => {
    if (!active) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const sync = () => {
      const vv = window.visualViewport;
      const width = Math.round(vv?.width ?? window.innerWidth);
      const height = Math.round(vv?.height ?? window.innerHeight);
      setBox({
        width,
        height,
        landscape: readIsLandscape(),
      });
    };

    const syncSoon = () => {
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      sync();
      for (const ms of [16, 80, 200, 400, 800]) {
        timers.push(setTimeout(sync, ms));
      }
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", syncSoon);
    window.addEventListener("resize", syncSoon);
    window.addEventListener("orientationchange", syncSoon);
    const mq = window.matchMedia("(orientation: landscape)");
    mq.addEventListener("change", syncSoon);
    const onSO = () => syncSoon();
    window.screen?.orientation?.addEventListener?.("change", onSO);

    return () => {
      for (const t of timers) clearTimeout(t);
      vv?.removeEventListener("resize", syncSoon);
      window.removeEventListener("resize", syncSoon);
      window.removeEventListener("orientationchange", syncSoon);
      mq.removeEventListener("change", syncSoon);
      window.screen?.orientation?.removeEventListener?.("change", onSO);
    };
  }, [active]);

  return box;
}

/** Pinch + button zoom for the fullscreen mueble; pan via native scroll. */
function useExpandedZoom(active: boolean) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  zoomRef.current = zoom;

  useEffect(() => {
    if (!active) {
      setZoom(1);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let tries = 0;
    let cleanupListeners: (() => void) | null = null;

    const attach = () => {
      if (cancelled) return;
      const el = viewportRef.current;
      if (!el) {
        if (tries++ < 40) {
          raf = window.requestAnimationFrame(attach);
        }
        return;
      }

      let startDist = 0;
      let startZoom = 1;

      const touchDist = (touches: TouchList) => {
        if (touches.length < 2) return 0;
        return Math.hypot(
          touches[0].clientX - touches[1].clientX,
          touches[0].clientY - touches[1].clientY
        );
      };

      const onStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          startDist = touchDist(e.touches);
          startZoom = zoomRef.current;
        }
      };

      const onMove = (e: TouchEvent) => {
        if (e.touches.length !== 2 || startDist <= 0) return;
        e.preventDefault();
        const d = touchDist(e.touches);
        if (d <= 0) return;
        setZoom(clampZoom(startZoom * (d / startDist)));
      };

      const onEnd = () => {
        startDist = 0;
      };

      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.92 : 1.08;
        setZoom((z) => clampZoom(z * factor));
      };

      el.addEventListener("touchstart", onStart, { passive: true });
      el.addEventListener("touchmove", onMove, { passive: false });
      el.addEventListener("touchend", onEnd);
      el.addEventListener("touchcancel", onEnd);
      el.addEventListener("wheel", onWheel, { passive: false });

      cleanupListeners = () => {
        el.removeEventListener("touchstart", onStart);
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", onEnd);
        el.removeEventListener("touchcancel", onEnd);
        el.removeEventListener("wheel", onWheel);
      };
    };

    attach();
    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      cleanupListeners?.();
    };
  }, [active]);

  return {
    zoom,
    setZoom,
    viewportRef,
    zoomIn: () => setZoom((z) => clampZoom(z * 1.18)),
    zoomOut: () => setZoom((z) => clampZoom(z / 1.18)),
    zoomReset: () => setZoom(1),
  };
}

export function CellarMap({
  wines,
  cols,
  rows,
  cellarId,
  highlightedIds,
  selectedId,
  title,
  movingWineId = null,
  onSelect,
  onEmptySlot,
  onMoveWine,
  onPickForMove,
  onCancelMove,
  onPlaceAt,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const touchUi = useTouchMoveUi();
  const abajo = wines.filter((w) => !w.slot || w.slot === "abajo");
  const [expanded, setExpanded] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [showMoveHint, setShowMoveHint] = useState(false);
  const didDrag = useRef(false);
  const mapScrollRef = useRef<HTMLDivElement | null>(null);
  const {
    zoom,
    setZoom,
    viewportRef: zoomViewportRef,
    zoomIn,
    zoomOut,
    zoomReset,
  } = useExpandedZoom(expanded);
  const viewport = useExpandedViewport(expanded);
  /**
   * Many phones (esp. iOS / old PWA installs) never unlock portrait for the
   * webview. Simulate landscape with a rotated frame that STILL scrolls & zooms.
   * Drop simulation when the OS itself is already landscape.
   */
  const cssLandscape = expanded && touchUi && !viewport.landscape;

  /** True screen box — prefer the larger pair so the rotated frame fills edge-to-edge. */
  const screenLong = Math.max(viewport.width || 0, viewport.height || 0);
  const screenShort = Math.min(viewport.width || 0, viewport.height || 0);

  async function openExpanded() {
    setExpanded(true);
    void tryLockLandscape().then(() => {
      window.dispatchEvent(new Event("resize"));
    });
  }

  function closeExpanded() {
    setExpanded(false);
    tryUnlockOrientation();
  }

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    try {
      setShowMoveHint(localStorage.getItem(MOVE_HINT_KEY) !== "1");
    } catch {
      setShowMoveHint(true);
    }
  }, []);

  function dismissMoveHint() {
    setShowMoveHint(false);
    try {
      localStorage.setItem(MOVE_HINT_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExpanded();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);
  const emptyTapRef = useRef<{
    slot: string;
    x: number;
    y: number;
  } | null>(null);
  const pressRef = useRef<{
    wineId: string;
    startX: number;
    startY: number;
    pointerId: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  /** Cancel long-press when the map itself is scrolling (avoids move vs pan fight). */
  useEffect(() => {
    const el = expanded ? zoomViewportRef.current : mapScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const state = pressRef.current;
      if (!state) return;
      if (state.timer) clearTimeout(state.timer);
      pressRef.current = null;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [expanded, zoomViewportRef, wines.length, cols, rows.join(",")]);

  const activeMoveId = movingWineId || dragId;
  const movingWine = activeMoveId
    ? wines.find((w) => w.id === activeMoveId) ?? null
    : null;
  const pickMode = Boolean(movingWineId);
  const emptySlots =
    pickMode && cellarId
      ? getEmptySlots(wines, cols, rows, cellarId)
      : [];
  const firstEmptySlot = emptySlots[0] ?? null;

  function clearDesktopDrag() {
    setDragId(null);
    setOverTarget(null);
  }

  function handleDesktopMove(wineId: string, target: string) {
    if (!onMoveWine) return;
    const wine = wines.find((w) => w.id === wineId);
    const current =
      wine?.slot && wine.slot !== "abajo" ? wine.slot : "abajo";
    if (current === target && wine?.cellarId === cellarId) {
      clearDesktopDrag();
      return;
    }
    onMoveWine(wineId, target);
    clearDesktopDrag();
  }

  function beginPress(wine: Wine, e: ReactPointerEvent<HTMLElement>) {
    if (!onPickForMove) return;
    if (e.button !== 0) return;
    // Don't arm pick while starting an HTML5 drag on fine pointers
    if (!touchUi && e.pointerType === "mouse") return;
    if (pressRef.current?.timer) clearTimeout(pressRef.current.timer);

    pressRef.current = {
      wineId: wine.id,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      timer: setTimeout(() => {
        onPickForMove(wine);
        didDrag.current = true;
        pressRef.current = null;
      }, LONG_PRESS_MS),
    };
  }

  function updatePress(e: ReactPointerEvent<HTMLElement>) {
    const state = pressRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.hypot(dx, dy) >= MOVE_THRESHOLD_PX) {
      if (state.timer) clearTimeout(state.timer);
      pressRef.current = null;
    }
  }

  function endPress(e: ReactPointerEvent<HTMLElement>) {
    const state = pressRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    if (state.timer) clearTimeout(state.timer);
    pressRef.current = null;
  }

  function interactSlot(slot: string, wineThere: Wine | null) {
    if (pickMode && onPlaceAt) {
      if (wineThere && wineThere.id === movingWineId) {
        onCancelMove?.();
        return;
      }
      onPlaceAt(slot);
      return;
    }
    if (wineThere) {
      // Leave fullscreen so mobile Detalle / desktop detail panel are visible.
      closeExpanded();
      onSelect(wineThere);
      return;
    }
    onEmptySlot?.(slot);
  }

  const selectedWine = selectedId
    ? wines.find((w) => w.id === selectedId) ?? null
    : null;
  const canSendAbajo =
    Boolean(onMoveWine) &&
    selectedWine &&
    !pickMode &&
    selectedWine.slot &&
    selectedWine.slot !== "abajo";
  const mapTitle = title?.trim() || t("map.defaultTitle");
  const gridNaturalW = LABEL_COL_PX + cols * BASE_CELL_PX + Math.max(0, cols) * 4;
  const gridNaturalH =
    24 + rows.length * BASE_CELL_PX + Math.max(0, rows.length) * 4;

  // Fit the full mueble into the landscape frame when Ampliar opens / rotates.
  useEffect(() => {
    if (!expanded) return;
    const longSide =
      screenLong ||
      Math.max(window.innerWidth, window.innerHeight);
    const shortSide =
      screenShort ||
      Math.min(window.innerWidth, window.innerHeight);
    if (longSide < 80 || shortSide < 80) return;
    const availW = longSide - 12;
    const availH = shortSide - (cssLandscape ? 88 : 120);
    if (availW <= 0 || availH <= 0) return;
    const fit = Math.min(
      availW / gridNaturalW,
      availH / gridNaturalH,
      1.45
    );
    setZoom(clampZoom(fit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    expanded,
    cssLandscape,
    screenLong,
    screenShort,
    gridNaturalW,
    gridNaturalH,
  ]);

  const rowProps = {
    cols,
    cellarId,
    wines,
    highlightedIds,
    selectedId,
    activeMoveId,
    overTarget,
    didDrag,
    emptyTapRef,
    touchUi,
    pickMode,
    onInteractSlot: interactSlot,
    onMoveWine: handleDesktopMove,
    setDragId,
    setOverTarget,
    clearDesktopDrag,
    beginPress,
    updatePress,
    endPress,
  } as const;

  const gridInner = (
    <div
      className="grid min-w-[640px] gap-1 sm:min-w-[760px] sm:gap-1.5"
      style={{
        gridTemplateColumns: `20px repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      <div />
      {Array.from({ length: cols }, (_, i) => (
        <div
          key={`col-${i + 1}`}
          className="pb-1 text-center text-[10px] font-medium text-ink-soft sm:text-[11px]"
        >
          {i + 1}
        </div>
      ))}

      {rows.map((row) => (
        <Row key={row} row={row} {...rowProps} />
      ))}
    </div>
  );

  const expandedGridInner = (
    <div
      className="map-expanded-grid"
      style={{
        gridTemplateColumns: `${LABEL_COL_PX}px repeat(${cols}, ${BASE_CELL_PX}px)`,
        width: gridNaturalW,
        gap: 4,
      }}
    >
      <div />
      {Array.from({ length: cols }, (_, i) => (
        <div
          key={`col-x-${i + 1}`}
          className="pb-1 text-center text-[10px] font-medium text-ink-soft"
        >
          {i + 1}
        </div>
      ))}
      {rows.map((row) => (
        <Row key={`x-${row}`} row={row} {...rowProps} />
      ))}
    </div>
  );

  const mapGrid = (
    <div ref={mapScrollRef} className="map-scroll pb-1">
      {gridInner}
    </div>
  );

  const mapBody = (
    <>
      {movingWine && pickMode ? (
        <div className="rounded-[10px] border border-[rgba(110,31,44,0.35)] bg-[rgba(250,249,245,0.96)] px-3 py-2">
          <p className="text-sm font-medium text-ink">
            {t("map.movingName", { name: movingWine.name })}
          </p>
          <p className="text-xs text-ink-soft">
            {expanded ? t("map.movingHintExpanded") : t("map.movingHint")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {onPlaceAt ? (
              <button
                type="button"
                className="btn btn-primary min-h-[36px] px-3 text-xs disabled:opacity-50"
                disabled={!firstEmptySlot}
                title={
                  firstEmptySlot
                    ? t("map.placeInSlot", { slot: firstEmptySlot })
                    : t("map.noFreeSlotsInUnit")
                }
                onClick={() => {
                  if (firstEmptySlot) onPlaceAt(firstEmptySlot);
                }}
              >
                {firstEmptySlot
                  ? t("map.occupySlot")
                  : t("map.noFreeSlots")}
              </button>
            ) : null}
            {!expanded ? (
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] px-3 text-xs"
                aria-label={t("map.expandAria")}
                onClick={() => void openExpanded()}
              >
                {t("map.expand")}
              </button>
            ) : null}
            {onCancelMove ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--wine)] underline-offset-2 hover:underline"
                onClick={onCancelMove}
              >
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
        </div>
      ) : movingWine && dragId ? (
        <div className="sticky top-0 z-10 rounded-[10px] border border-[rgba(110,31,44,0.35)] bg-[rgba(250,249,245,0.96)] px-3 py-2 shadow-sm backdrop-blur-sm">
          <p className="text-sm font-medium text-ink">
            {t("map.droppingName", { name: movingWine.name })}
          </p>
          <p className="text-xs text-ink-soft">{t("map.droppingHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {showMoveHint && onPickForMove ? (
            <div className="flex items-start justify-between gap-3 rounded-[10px] border border-[rgba(110,31,44,0.22)] bg-[rgba(122,36,48,0.05)] px-3 py-2">
              <p className="text-xs leading-relaxed text-ink sm:text-[13px]">
                {touchUi ? t("map.moveHintTouch") : t("map.moveHintDesktop")}
              </p>
              <button
                type="button"
                className="shrink-0 text-[11px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                onClick={dismissMoveHint}
              >
                {t("common.dismiss")}
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!expanded ? (
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] px-3 text-xs"
                aria-label={t("map.expandAria")}
                onClick={() => void openExpanded()}
              >
                {t("map.expand")}
              </button>
            ) : null}
            {canSendAbajo && selectedWine ? (
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] px-3 text-xs"
                onClick={() => onMoveWine?.(selectedWine.id, "abajo")}
              >
                {t("map.sendBelowOut")}
              </button>
            ) : null}
            {!pickMode && selectedWine && onPickForMove ? (
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] px-3 text-xs"
                onClick={() => onPickForMove(selectedWine)}
              >
                {t("map.move")}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {mapGrid}

      <div className="border-t border-[var(--line)] pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft sm:text-xs">
            {t("map.belowOut")}
          </p>
          <p className="text-xs text-ink-soft">
            {t("map.bottleCount", { count: abajo.length })}
          </p>
        </div>
        <p className="mb-2 text-xs text-ink-soft">{t("map.belowZoneHint")}</p>

        <div
          data-slot="abajo"
          onDragOver={(e) => {
            if (!onMoveWine || touchUi || pickMode) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverTarget("abajo");
          }}
          onDragLeave={() => setOverTarget(null)}
          onDrop={(e) => {
            if (touchUi || pickMode) return;
            e.preventDefault();
            const id = e.dataTransfer.getData(DRAG_MIME) || dragId;
            if (id) handleDesktopMove(id, "abajo");
            else clearDesktopDrag();
          }}
          onClick={() => {
            if (pickMode && onPlaceAt) onPlaceAt("abajo");
          }}
          className={[
            "min-h-[56px] rounded-[10px] border border-dashed p-2 transition",
            pickMode ? "cursor-pointer" : "",
            overTarget === "abajo" || (pickMode && movingWineId)
              ? "border-[var(--wine)] bg-[rgba(122,36,48,0.08)]"
              : "border-[var(--line)] bg-[rgba(255,252,247,0.35)]",
          ].join(" ")}
        >
          <div className="flex flex-wrap gap-2">
            {abajo.length === 0 ? (
              <p className="px-1 py-2 text-sm text-ink-soft">
                {pickMode
                  ? t("map.tapToDropBelow")
                  : overTarget === "abajo"
                    ? t("map.dropToSendBelow")
                    : t("map.noBottlesOffGrid")}
              </p>
            ) : (
              abajo.map((wine) => {
                const active = wine.id === selectedId;
                const dimmed =
                  highlightedIds.size > 0 && !highlightedIds.has(wine.id);
                const isMoving = activeMoveId === wine.id;
                return (
                  <div
                    key={wine.id}
                    role="button"
                    tabIndex={0}
                    data-slot="abajo"
                    draggable={!touchUi && !pickMode && Boolean(onMoveWine)}
                    onPointerDown={(e) => beginPress(wine, e)}
                    onPointerMove={updatePress}
                    onPointerUp={endPress}
                    onPointerCancel={endPress}
                    onDragStart={(e) => {
                      if (touchUi || pickMode) {
                        e.preventDefault();
                        return;
                      }
                      didDrag.current = false;
                      setDragId(wine.id);
                      e.dataTransfer.setData(DRAG_MIME, wine.id);
                      e.dataTransfer.effectAllowed = "move";
                      requestAnimationFrame(() => {
                        didDrag.current = true;
                      });
                    }}
                    onDragEnd={clearDesktopDrag}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        interactSlot("abajo", wine);
                      }
                    }}
                    onClick={() => {
                      if (didDrag.current) {
                        didDrag.current = false;
                        return;
                      }
                      interactSlot("abajo", wine);
                    }}
                    className={[
                      "map-cell map-cell--draggable inline-flex min-h-[44px] max-w-full cursor-grab items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left text-sm transition active:cursor-grabbing",
                      active || isMoving
                        ? "border-[var(--wine)] bg-[rgba(122,36,48,0.08)] text-ink slot-active"
                        : "border-[var(--line)] bg-[rgba(255,252,247,0.55)] text-ink hover:border-[rgba(122,36,48,0.35)]",
                      dimmed ? "opacity-35" : "",
                      isMoving ? "ring-2 ring-[var(--wine)] opacity-90" : "",
                    ].join(" ")}
                  >
                    <CountryFlag country={wine.country} size="sm" />
                    <span className="min-w-0">
                      <span className="block max-w-[10rem] truncate font-medium leading-tight sm:max-w-[14rem]">
                        {wine.name}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {countryDisplayName(wine.country, locale)}
                      </span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );

  const mapShell = (
    <div className={["space-y-4", dragId ? "map-is-dragging" : ""].join(" ")}>
      {mapBody}
    </div>
  );

  const longSide =
    screenLong ||
    (typeof window !== "undefined"
      ? Math.max(window.innerWidth, window.innerHeight)
      : 0);
  const shortSide =
    screenShort ||
    (typeof window !== "undefined"
      ? Math.min(window.innerWidth, window.innerHeight)
      : 0);

  if (expanded && portalReady) {
    const zoomPct = Math.round(zoom * 100);

    /**
     * CSS landscape: a (long × short) box rotated 90° fills the portrait
     * screen edge-to-edge. Do NOT use the raw width/height pair — on some
     * WebViews those are already partially swapped and cause letterboxing.
     */
    const frameStyle = cssLandscape
      ? ({
          position: "absolute" as const,
          top: "50%",
          left: "50%",
          width: longSide,
          height: shortSide,
          maxWidth: "none",
          maxHeight: "none",
          transform: "translate(-50%, -50%) rotate(90deg)",
          transformOrigin: "center center",
          padding: 0,
        } as const)
      : ({
          position: "absolute" as const,
          inset: 0,
          width: "100%",
          height: "100%",
          maxWidth: "none",
          maxHeight: "none",
          transform: "none",
          paddingTop: "max(0.35rem, env(safe-area-inset-top))",
          paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.35rem, env(safe-area-inset-left))",
          paddingRight: "max(0.35rem, env(safe-area-inset-right))",
        } as const);

    return (
      <>
        <div className="space-y-3">
          <p className="text-xs text-ink-soft">{t("map.expandedNotice")}</p>
          <button
            type="button"
            className="btn btn-ghost min-h-[44px] px-3 text-xs"
            onClick={closeExpanded}
          >
            {t("common.close")}
          </button>
        </div>
        {createPortal(
          <div className="map-expanded-shell">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cellar-map-expanded-title"
              className={[
                "map-expanded-overlay flex flex-col bg-[var(--surface-solid)]",
                cssLandscape ? "map-expanded-overlay--css-land" : "",
                viewport.landscape ? "map-expanded-overlay--landscape" : "",
                dragId ? "map-is-dragging" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-orientation={
                cssLandscape
                  ? "css-landscape"
                  : viewport.landscape
                    ? "landscape"
                    : "portrait"
              }
              style={frameStyle}
            >
              <div className="map-expanded-header flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-2 py-1">
                <h2
                  id="cellar-map-expanded-title"
                  className="display min-w-0 truncate text-lg leading-tight text-ink"
                >
                  {mapTitle}
                </h2>
                <div className="flex shrink-0 items-center gap-1">
                  <div
                    className="inline-flex items-center rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.7)] p-0.5"
                    role="group"
                    aria-label={t("map.zoomAria")}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[36px] min-w-[36px] px-2 text-base"
                      aria-label={t("map.zoomOutAria")}
                      onClick={zoomOut}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="min-h-[36px] min-w-[2.75rem] px-1 text-xs font-medium text-ink-soft"
                      aria-label={t("map.zoomResetAria")}
                      title={t("map.zoomResetTitle")}
                      onClick={zoomReset}
                    >
                      {zoomPct}%
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[36px] min-w-[36px] px-2 text-base"
                      aria-label={t("map.zoomInAria")}
                      onClick={zoomIn}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center px-2 text-sm"
                    aria-label={t("map.closeExpandedAria")}
                    onClick={closeExpanded}
                  >
                    <span aria-hidden className="text-lg leading-none">
                      ×
                    </span>
                  </button>
                </div>
              </div>

              <div className="map-expanded-body flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-1.5 pb-1.5 pt-1">
                {movingWine && pickMode ? (
                  <div className="shrink-0 rounded-[10px] border border-[rgba(110,31,44,0.35)] bg-[rgba(250,249,245,0.96)] px-3 py-1.5">
                    <p className="text-sm font-medium text-ink">
                      {t("map.movingName", { name: movingWine.name })}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {onPlaceAt ? (
                        <button
                          type="button"
                          className="btn btn-primary min-h-[36px] px-3 text-xs disabled:opacity-50"
                          disabled={!firstEmptySlot}
                          onClick={() => {
                            if (firstEmptySlot) onPlaceAt(firstEmptySlot);
                          }}
                        >
                          {firstEmptySlot
                            ? t("map.occupySlot")
                            : t("map.noFreeSlots")}
                        </button>
                      ) : null}
                      {onCancelMove ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--wine)] underline-offset-2 hover:underline"
                          onClick={onCancelMove}
                        >
                          {t("common.cancel")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div ref={zoomViewportRef} className="map-expanded-viewport">
                  <div
                    className="map-expanded-zoom-space"
                    style={{
                      width: gridNaturalW * zoom,
                      height: gridNaturalH * zoom,
                    }}
                  >
                    <div
                      style={{
                        width: gridNaturalW,
                        transform: `scale(${zoom})`,
                        transformOrigin: "top left",
                      }}
                    >
                      {expandedGridInner}
                    </div>
                  </div>
                </div>

                <div className="map-expanded-abajo shrink-0 overflow-x-auto overflow-y-hidden overscroll-contain border-t border-[var(--line)] pt-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                      {t("map.belowOutCount", { count: abajo.length })}
                    </p>
                  </div>
                  <div
                    data-slot="abajo"
                    onDragOver={(e) => {
                      if (!onMoveWine || touchUi || pickMode) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setOverTarget("abajo");
                    }}
                    onDragLeave={() => setOverTarget(null)}
                    onDrop={(e) => {
                      if (touchUi || pickMode) return;
                      e.preventDefault();
                      const id = e.dataTransfer.getData(DRAG_MIME) || dragId;
                      if (id) handleDesktopMove(id, "abajo");
                      else clearDesktopDrag();
                    }}
                    onClick={() => {
                      if (pickMode && onPlaceAt) onPlaceAt("abajo");
                    }}
                    className={[
                      "min-h-[40px] rounded-[10px] border border-dashed p-1 transition",
                      pickMode ? "cursor-pointer" : "",
                      overTarget === "abajo" || (pickMode && movingWineId)
                        ? "border-[var(--wine)] bg-[rgba(122,36,48,0.08)]"
                        : "border-[var(--line)] bg-[rgba(255,252,247,0.35)]",
                    ].join(" ")}
                  >
                    <div className="flex flex-nowrap gap-1.5">
                      {abajo.length === 0 ? (
                        <p className="px-1 py-1 text-xs text-ink-soft">
                          {pickMode
                            ? t("map.tapToDropBelow")
                            : t("map.noBottlesOff")}
                        </p>
                      ) : (
                        abajo.map((wine) => {
                          const active = wine.id === selectedId;
                          const isMoving = activeMoveId === wine.id;
                          return (
                            <div
                              key={wine.id}
                              role="button"
                              tabIndex={0}
                              data-slot="abajo"
                              onPointerDown={(e) => beginPress(wine, e)}
                              onPointerMove={updatePress}
                              onPointerUp={endPress}
                              onPointerCancel={endPress}
                              onClick={() => {
                                if (didDrag.current) {
                                  didDrag.current = false;
                                  return;
                                }
                                interactSlot("abajo", wine);
                              }}
                              className={[
                                "map-cell map-cell--draggable inline-flex min-h-[36px] max-w-[9rem] shrink-0 cursor-grab items-center gap-1.5 rounded-[10px] border px-2 py-1 text-left text-xs transition",
                                active || isMoving
                                  ? "border-[var(--wine)] bg-[rgba(122,36,48,0.08)] text-ink slot-active"
                                  : "border-[var(--line)] bg-[rgba(255,252,247,0.55)] text-ink",
                                isMoving
                                  ? "ring-2 ring-[var(--wine)] opacity-90"
                                  : "",
                              ].join(" ")}
                            >
                              <CountryFlag country={wine.country} size="sm" />
                              <span className="truncate font-medium">
                                {wine.name}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return mapShell;
}

function Row({
  row,
  cols,
  cellarId,
  wines,
  highlightedIds,
  selectedId,
  activeMoveId,
  overTarget,
  didDrag,
  emptyTapRef,
  touchUi,
  pickMode,
  onInteractSlot,
  onMoveWine,
  setDragId,
  setOverTarget,
  clearDesktopDrag,
  beginPress,
  updatePress,
  endPress,
}: {
  row: string;
  cols: number;
  cellarId: string | null;
  wines: Wine[];
  highlightedIds: Set<string>;
  selectedId: string | null;
  activeMoveId: string | null;
  overTarget: string | null;
  didDrag: MutableRefObject<boolean>;
  emptyTapRef: MutableRefObject<{
    slot: string;
    x: number;
    y: number;
  } | null>;
  touchUi: boolean;
  pickMode: boolean;
  onInteractSlot: (slot: string, wine: Wine | null) => void;
  onMoveWine: (wineId: string, target: string) => void;
  setDragId: (id: string | null) => void;
  setOverTarget: (slot: string | null) => void;
  clearDesktopDrag: () => void;
  beginPress: (wine: Wine, e: ReactPointerEvent<HTMLElement>) => void;
  updatePress: (e: ReactPointerEvent<HTMLElement>) => void;
  endPress: (e: ReactPointerEvent<HTMLElement>) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <>
      <div className="flex items-center text-[10px] font-medium text-ink-soft sm:text-[11px]">
        {row}
      </div>
      {Array.from({ length: cols }, (_, i) => {
        const col = i + 1;
        const slot = `${col}${row}`;
        const wine = getWineBySlot(wines, slot, cellarId);
        const active = wine?.id === selectedId;
        const isOver = overTarget === slot || (pickMode && !wine);
        const dimmed =
          wine != null &&
          highlightedIds.size > 0 &&
          !highlightedIds.has(wine.id);
        const isMoving = wine != null && activeMoveId === wine.id;

        const dropHandlers =
          touchUi || pickMode
            ? {}
            : {
                onDragOver: (e: DragEvent) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverTarget(slot);
                },
                onDragLeave: () => setOverTarget(null),
                onDrop: (e: DragEvent) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData(DRAG_MIME);
                  if (id) onMoveWine(id, slot);
                  else clearDesktopDrag();
                },
              };

        if (!wine) {
          return (
            <button
              key={slot}
              type="button"
              data-slot={slot}
              aria-label={
                pickMode || activeMoveId
                  ? t("map.dropInSlot", { slot })
                  : t("map.addWineInSlot", { slot })
              }
              title={
                pickMode || activeMoveId
                  ? t("map.dropHere", { slot })
                  : t("map.emptyTapToAdd", { slot })
              }
              {...dropHandlers}
              onPointerDown={(e) => {
                emptyTapRef.current = {
                  slot,
                  x: e.clientX,
                  y: e.clientY,
                };
              }}
              onPointerUp={(e) => {
                const tap = emptyTapRef.current;
                emptyTapRef.current = null;
                if (!tap || tap.slot !== slot) return;
                if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 12) {
                  return;
                }
                if (pickMode) {
                  onInteractSlot(slot, null);
                  return;
                }
                if (e.pointerType === "touch" || e.pointerType === "pen") {
                  onInteractSlot(slot, null);
                }
              }}
              onClick={() => {
                if (touchUi && !pickMode) return;
                onInteractSlot(slot, null);
              }}
              className={[
                "map-cell flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[6px] border border-dashed text-[11px] transition sm:min-h-[58px] sm:rounded-[8px]",
                pickMode
                  ? "border-[var(--wine)] bg-[rgba(122,36,48,0.16)] text-[var(--wine)] ring-2 ring-[rgba(110,31,44,0.45)] ring-offset-1 ring-offset-[rgba(250,249,245,0.9)]"
                  : isOver
                    ? "border-[var(--wine)] bg-[rgba(122,36,48,0.14)] text-[var(--wine)] ring-2 ring-[var(--wine)]"
                    : "border-[rgba(26,23,20,0.18)] bg-[rgba(255,252,247,0.25)] text-ink-soft hover:border-[var(--wine)] hover:bg-[rgba(122,36,48,0.06)]",
              ].join(" ")}
            >
              {pickMode ? (
                <>
                  <span className="text-[10px] font-semibold leading-none">
                    {slot}
                  </span>
                  <span className="text-[9px] leading-none opacity-80">
                    {t("map.free")}
                  </span>
                </>
              ) : isOver ? (
                "↓"
              ) : (
                "+"
              )}
            </button>
          );
        }

        const label = cellLabel(wine);
        const meta = cellMeta(wine);
        const tip = [
          wine.name,
          wine.winery,
          wine.vintage != null ? String(wine.vintage) : "",
          wine.cavataleRating != null
            ? `Cavatale ${formatCavataleRating(wine.cavataleRating)}`
            : "",
          countryDisplayName(wine.country, locale),
          wine.type,
          slot,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <div
            key={slot}
            role="button"
            tabIndex={0}
            data-slot={slot}
            title={tip}
            draggable={!touchUi && !pickMode}
            {...dropHandlers}
            onPointerDown={(e) => beginPress(wine, e)}
            onPointerMove={updatePress}
            onPointerUp={endPress}
            onPointerCancel={endPress}
            onDragStart={(e) => {
              if (touchUi || pickMode) {
                e.preventDefault();
                return;
              }
              didDrag.current = false;
              setDragId(wine.id);
              e.dataTransfer.setData(DRAG_MIME, wine.id);
              e.dataTransfer.effectAllowed = "move";
              requestAnimationFrame(() => {
                didDrag.current = true;
              });
            }}
            onDragEnd={clearDesktopDrag}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onInteractSlot(slot, wine);
              }
            }}
            onClick={() => {
              if (didDrag.current) {
                didDrag.current = false;
                return;
              }
              onInteractSlot(slot, wine);
            }}
            className={[
              "map-cell map-cell--draggable flex min-h-[52px] cursor-grab flex-col items-stretch justify-center gap-0.5 rounded-[6px] border px-0.5 py-1 text-left transition active:cursor-grabbing sm:min-h-[58px] sm:rounded-[8px] sm:px-1",
              active || isMoving
                ? "border-[var(--wine)] bg-[rgba(122,36,48,0.12)] slot-active"
                : "border-[rgba(122,36,48,0.18)] bg-[linear-gradient(160deg,rgba(122,36,48,0.14),rgba(255,252,247,0.55))]",
              isOver ? "ring-2 ring-[rgba(110,31,44,0.35)]" : "",
              dimmed ? "opacity-30" : "hover:border-[var(--wine)]",
              isMoving ? "ring-2 ring-[var(--wine)] opacity-95" : "",
              pickMode && !isMoving ? "opacity-80" : "",
            ].join(" ")}
            style={{
              borderLeftColor: typeAccent(wine.type),
              borderLeftWidth: 3,
            }}
          >
            <span className="flex items-center px-0.5">
              <CountryFlag country={wine.country} size="xs" />
            </span>
            <span className="block truncate px-0.5 text-[9px] font-semibold leading-tight text-ink sm:text-[10px]">
              {label}
            </span>
            {meta ? (
              <span
                className={[
                  "block truncate px-0.5 leading-none",
                  wine.cavataleRating != null
                    ? "font-medium tabular-nums text-[9px] text-ink sm:text-[10px]"
                    : "text-[8px] text-ink-soft sm:text-[9px]",
                ].join(" ")}
              >
                {meta}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
