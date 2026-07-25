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
import { CountryFlag } from "@/components/CountryFlag";
import {
  formatVivino,
  getEmptySlots,
  getWineBySlot,
  typeAccent,
} from "@/lib/wines";

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
  if (name.length <= 11) return name;
  const words = name.split(/\s+/).filter(Boolean);
  if (words[0] && words[0].length >= 4 && words[0].length <= 11) {
    return words[0];
  }
  return `${name.slice(0, 10)}…`;
}

function cellMeta(wine: Wine): string {
  const bits: string[] = [];
  if (wine.cavataleRating != null) bits.push(formatVivino(wine.cavataleRating));
  else if (wine.vivino != null) bits.push(formatVivino(wine.vivino));
  else if (wine.vintage != null) bits.push(String(wine.vintage));
  else if (wine.type) bits.push(wine.type.slice(0, 3));
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
  const touchUi = useTouchMoveUi();
  const abajo = wines.filter((w) => !w.slot || w.slot === "abajo");
  const [expanded, setExpanded] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [showMoveHint, setShowMoveHint] = useState(false);
  const didDrag = useRef(false);

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
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
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
  const mapScrollRef = useRef<HTMLDivElement | null>(null);

  /** Cancel long-press when the map itself is scrolling (avoids move vs pan fight). */
  useEffect(() => {
    const el = mapScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const state = pressRef.current;
      if (!state) return;
      if (state.timer) clearTimeout(state.timer);
      pressRef.current = null;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [expanded, wines.length, cols, rows.join(",")]);

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
      setExpanded(false);
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
  const mapTitle = title?.trim() || "Mapa del mueble";

  const mapBody = (
    <>
      {movingWine && pickMode ? (
        <div className="rounded-[10px] border border-[rgba(110,31,44,0.35)] bg-[rgba(250,249,245,0.96)] px-3 py-2">
          <p className="text-sm font-medium text-ink">
            Moviendo · {movingWine.name}
          </p>
          <p className="text-xs text-ink-soft">
            {expanded
              ? "Ahora toca el hueco donde quieres dejarla. Cierra el mapa para cambiar de mueble."
              : "Ahora toca el hueco destino. Puedes cambiar de mueble arriba."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {onPlaceAt ? (
              <button
                type="button"
                className="btn btn-primary min-h-[36px] px-3 text-xs disabled:opacity-50"
                disabled={!firstEmptySlot}
                title={
                  firstEmptySlot
                    ? `Colocar en ${firstEmptySlot}`
                    : "Este mueble no tiene huecos libres"
                }
                onClick={() => {
                  if (firstEmptySlot) onPlaceAt(firstEmptySlot);
                }}
              >
                {firstEmptySlot
                  ? "Ocupar espacio disponible"
                  : "Sin huecos libres"}
              </button>
            ) : null}
            {!expanded ? (
              <button
                type="button"
                className="btn btn-ghost min-h-[44px] px-3 text-xs"
                aria-label="Ampliar mapa"
                onClick={() => setExpanded(true)}
              >
                Ampliar
              </button>
            ) : null}
            {onCancelMove ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--wine)] underline-offset-2 hover:underline"
                onClick={onCancelMove}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      ) : movingWine && dragId ? (
        <div className="sticky top-0 z-10 rounded-[10px] border border-[rgba(110,31,44,0.35)] bg-[rgba(250,249,245,0.96)] px-3 py-2 shadow-sm backdrop-blur-sm">
          <p className="text-sm font-medium text-ink">
            Soltando · {movingWine.name}
          </p>
          <p className="text-xs text-ink-soft">
            Suelta sobre el hueco nuevo o en Abajo / fuera.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {showMoveHint && onPickForMove ? (
            <div className="flex items-start justify-between gap-3 rounded-[10px] border border-[rgba(110,31,44,0.22)] bg-[rgba(122,36,48,0.05)] px-3 py-2">
              <p className="text-xs leading-relaxed text-ink sm:text-[13px]">
                {touchUi
                  ? "Para mover: deja presionada la botella; luego toca el hueco nuevo."
                  : "Para mover: arrastra la botella al hueco nuevo (o a Abajo / fuera)."}
              </p>
              <button
                type="button"
                className="shrink-0 text-[11px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                onClick={dismissMoveHint}
              >
                Entendido
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-soft">
              {touchUi
                ? "Deja presionada → elige hueco · toca = ver · + = agregar"
                : "Arrastra al hueco · clic = ver · + = agregar"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {!expanded ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] px-3 text-xs"
                  aria-label="Ampliar mapa"
                  onClick={() => setExpanded(true)}
                >
                  Ampliar
                </button>
              ) : null}
              {canSendAbajo && selectedWine ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] px-3 text-xs"
                  onClick={() => onMoveWine?.(selectedWine.id, "abajo")}
                >
                  Enviar abajo / fuera
                </button>
              ) : null}
              {!pickMode && selectedWine && onPickForMove ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px] px-3 text-xs"
                  onClick={() => onPickForMove(selectedWine)}
                >
                  Mover…
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div ref={mapScrollRef} className="map-scroll pb-1">
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
            <Row
              key={row}
              row={row}
              cols={cols}
              cellarId={cellarId}
              wines={wines}
              highlightedIds={highlightedIds}
              selectedId={selectedId}
              activeMoveId={activeMoveId}
              overTarget={overTarget}
              didDrag={didDrag}
              emptyTapRef={emptyTapRef}
              touchUi={touchUi}
              pickMode={pickMode}
              onInteractSlot={interactSlot}
              onMoveWine={handleDesktopMove}
              setDragId={setDragId}
              setOverTarget={setOverTarget}
              clearDesktopDrag={clearDesktopDrag}
              beginPress={beginPress}
              updatePress={updatePress}
              endPress={endPress}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--line)] pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft sm:text-xs">
            Abajo / fuera
          </p>
          <p className="text-xs text-ink-soft">{abajo.length} botellas</p>
        </div>
        <p className="mb-2 text-xs text-ink-soft">
          Zona temporal compartida. Desde aquí puedes llevar una botella a
          cualquier mueble.
        </p>

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
                  ? "Toca para soltar abajo / fuera"
                  : overTarget === "abajo"
                    ? "Suelta para mandar abajo / fuera"
                    : "Sin botellas fuera de la rejilla."}
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
                        {wine.country}
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

  if (expanded && portalReady) {
    return (
      <>
        <div className="space-y-3">
          <p className="text-xs text-ink-soft">Mapa ampliado a pantalla completa.</p>
          <button
            type="button"
            className="btn btn-ghost min-h-[44px] px-3 text-xs"
            onClick={() => setExpanded(false)}
          >
            Cerrar
          </button>
        </div>
        {createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cellar-map-expanded-title"
            className="fixed inset-0 z-[45] flex flex-col bg-[var(--surface-solid)]"
            style={{
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
              paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
              paddingRight: "max(0.75rem, env(safe-area-inset-right))",
            }}
          >
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
              <h2
                id="cellar-map-expanded-title"
                className="display min-w-0 text-xl leading-tight text-ink sm:text-2xl"
              >
                {mapTitle}
              </h2>
              <button
                type="button"
                className="btn btn-ghost flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 px-3 text-sm"
                aria-label="Cerrar mapa ampliado"
                onClick={() => setExpanded(false)}
              >
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
                <span>Cerrar</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
              {mapShell}
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
                  ? `Soltar en ${slot}`
                  : `Agregar vino en ${slot}`
              }
              title={
                pickMode || activeMoveId
                  ? `Soltar aquí (${slot})`
                  : `${slot} vacío — tocar para agregar`
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
                    libre
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
          slot,
          wine.name,
          wine.winery,
          wine.country,
          wine.vintage != null ? String(wine.vintage) : "",
          wine.vivino != null
            ? `Calificación Vivino ${wine.vivino.toFixed(1)}`
            : "",
          wine.type,
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
              <span className="block truncate px-0.5 text-[8px] leading-none text-ink-soft sm:text-[9px]">
                {meta}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
