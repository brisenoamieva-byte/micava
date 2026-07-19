"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MutableRefObject,
} from "react";
import type { Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import {
  formatVivino,
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
  onSelect: (wine: Wine) => void;
  onEmptySlot?: (slot: string) => void;
  onMoveWine?: (wineId: string, targetLocation: string) => void;
};

const DRAG_MIME = "application/x-micava-wine";

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
  if (wine.vivino != null) bits.push(formatVivino(wine.vivino));
  else if (wine.vintage != null) bits.push(String(wine.vintage));
  else if (wine.type) bits.push(wine.type.slice(0, 3));
  return bits[0] ?? "";
}

function useTouchMoveUi() {
  const [touchUi, setTouchUi] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    setTouchUi(coarse || noHover || navigator.maxTouchPoints > 0);
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
  onSelect,
  onEmptySlot,
  onMoveWine,
}: Props) {
  const touchUi = useTouchMoveUi();
  const abajo = wines.filter((w) => !w.slot || w.slot === "abajo");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const didDrag = useRef(false);

  const movingId = dragId ?? pickedId;
  const pickedWine = pickedId
    ? wines.find((w) => w.id === pickedId) ?? null
    : null;

  function clearDrag() {
    setDragId(null);
    setOverTarget(null);
  }

  function handleMove(wineId: string, target: string) {
    if (!onMoveWine) return;
    onMoveWine(wineId, target);
    setPickedId(null);
    clearDrag();
  }

  /** Tap / click a bottle: on touch, first tap picks to move; second tap cancels. */
  function onWineActivate(wine: Wine) {
    if (!onMoveWine) {
      onSelect(wine);
      return;
    }

    // Already holding a bottle → drop onto this one (swap)
    if (pickedId && pickedId !== wine.id) {
      handleMove(pickedId, wine.slot && wine.slot !== "abajo" ? wine.slot : "abajo");
      onSelect(wine);
      return;
    }

    if (touchUi) {
      setPickedId((prev) => (prev === wine.id ? null : wine.id));
      onSelect(wine);
      return;
    }

    onSelect(wine);
  }

  function onEmptyActivate(slot: string) {
    if (pickedId && onMoveWine) {
      handleMove(pickedId, slot);
      return;
    }
    onEmptySlot?.(slot);
  }

  return (
    <div className="space-y-4">
      {pickedWine ? (
        <div className="sticky top-0 z-10 rounded-[10px] border border-[rgba(110,31,44,0.35)] bg-[rgba(250,249,245,0.96)] px-3 py-2 shadow-sm backdrop-blur-sm">
          <p className="text-sm font-medium text-ink">
            Mover · {pickedWine.name}
          </p>
          <p className="text-xs text-ink-soft">
            Toca un hueco (+) u otra botella para intercambiar. Toca de nuevo la
            misma para cancelar.
          </p>
          <button
            type="button"
            className="mt-1.5 text-xs text-[var(--wine-deep)] underline-offset-2 hover:underline"
            onClick={() => setPickedId(null)}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <p className="text-xs text-ink-soft">
          {touchUi
            ? "Toca una botella y luego el destino (en móvil no se arrastra)."
            : "Arrastra una botella para moverla · o tócala y luego el destino"}
        </p>
      )}

      <div className="map-scroll pb-1">
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
              movingId={movingId}
              overTarget={overTarget}
              didDrag={didDrag}
              touchUi={touchUi}
              onWineActivate={onWineActivate}
              onEmptyActivate={onEmptyActivate}
              onMoveWine={handleMove}
              setDragId={setDragId}
              setOverTarget={setOverTarget}
              clearDrag={clearDrag}
              pickedId={pickedId}
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
          Zona temporal — no es un mueble. Para acomodarlas: elige el mueble
          arriba y muévelas a un hueco de su rejilla.
        </p>

        <div
          onDragOver={(e) => {
            if (!onMoveWine || touchUi) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverTarget("abajo");
          }}
          onDragLeave={() => setOverTarget(null)}
          onDrop={(e) => {
            if (touchUi) return;
            e.preventDefault();
            const id = e.dataTransfer.getData(DRAG_MIME) || dragId;
            if (id) handleMove(id, "abajo");
            else clearDrag();
          }}
          onClick={() => {
            if (pickedId) handleMove(pickedId, "abajo");
          }}
          className={[
            "min-h-[56px] rounded-[10px] border border-dashed p-2 transition",
            overTarget === "abajo" || Boolean(pickedId)
              ? "border-[var(--wine)] bg-[rgba(122,36,48,0.08)]"
              : "border-[var(--line)] bg-[rgba(255,252,247,0.35)]",
            pickedId ? "cursor-pointer" : "",
          ].join(" ")}
        >
          <div className="flex flex-wrap gap-2">
            {abajo.length === 0 ? (
              <p className="px-1 py-2 text-sm text-ink-soft">
                {pickedId
                  ? "Toca aquí para mandar abajo / fuera"
                  : "Sin botellas fuera de la rejilla."}
              </p>
            ) : (
              abajo.map((wine) => {
                const active = wine.id === selectedId;
                const dimmed =
                  highlightedIds.size > 0 && !highlightedIds.has(wine.id);
                const isMoving = movingId === wine.id;
                return (
                  <button
                    key={wine.id}
                    type="button"
                    draggable={!touchUi && Boolean(onMoveWine)}
                    onDragStart={(e) => {
                      if (touchUi) return;
                      didDrag.current = false;
                      setDragId(wine.id);
                      e.dataTransfer.setData(DRAG_MIME, wine.id);
                      e.dataTransfer.effectAllowed = "move";
                      requestAnimationFrame(() => {
                        didDrag.current = true;
                      });
                    }}
                    onDragEnd={clearDrag}
                    onClick={() => {
                      if (didDrag.current) {
                        didDrag.current = false;
                        return;
                      }
                      onWineActivate(wine);
                    }}
                    className={[
                      "inline-flex min-h-[44px] max-w-full cursor-pointer items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left text-sm transition",
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
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  row,
  cols,
  cellarId,
  wines,
  highlightedIds,
  selectedId,
  movingId,
  overTarget,
  didDrag,
  touchUi,
  onWineActivate,
  onEmptyActivate,
  onMoveWine,
  setDragId,
  setOverTarget,
  clearDrag,
  pickedId,
}: {
  row: string;
  cols: number;
  cellarId: string | null;
  wines: Wine[];
  highlightedIds: Set<string>;
  selectedId: string | null;
  movingId: string | null;
  overTarget: string | null;
  didDrag: MutableRefObject<boolean>;
  touchUi: boolean;
  onWineActivate: (wine: Wine) => void;
  onEmptyActivate: (slot: string) => void;
  onMoveWine: (wineId: string, target: string) => void;
  setDragId: (id: string | null) => void;
  setOverTarget: (slot: string | null) => void;
  clearDrag: () => void;
  pickedId: string | null;
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
        const isOver = overTarget === slot;
        const dimmed =
          wine != null &&
          highlightedIds.size > 0 &&
          !highlightedIds.has(wine.id);
        const isMoving = wine != null && movingId === wine.id;
        const dropReady = Boolean(pickedId);

        const dropHandlers = touchUi
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
                else clearDrag();
              },
            };

        if (!wine) {
          return (
            <button
              key={slot}
              type="button"
              title={
                dropReady
                  ? `Soltar aquí (${slot})`
                  : `${slot} vacío — tocar para agregar`
              }
              {...dropHandlers}
              onClick={() => onEmptyActivate(slot)}
              className={[
                "flex min-h-[52px] items-center justify-center rounded-[6px] border border-dashed text-[11px] transition sm:min-h-[58px] sm:rounded-[8px]",
                isOver || dropReady
                  ? "border-[var(--wine)] bg-[rgba(122,36,48,0.14)] text-[var(--wine)]"
                  : "border-[rgba(26,23,20,0.18)] bg-[rgba(255,252,247,0.25)] text-ink-soft hover:border-[var(--wine)] hover:bg-[rgba(122,36,48,0.06)]",
              ].join(" ")}
            >
              {dropReady ? "↓" : "+"}
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
          wine.vivino != null ? `Vivino ${wine.vivino.toFixed(1)}` : "",
          wine.type,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <button
            key={slot}
            type="button"
            title={tip}
            draggable={!touchUi}
            {...dropHandlers}
            onDragStart={(e) => {
              if (touchUi) return;
              didDrag.current = false;
              setDragId(wine.id);
              e.dataTransfer.setData(DRAG_MIME, wine.id);
              e.dataTransfer.effectAllowed = "move";
              requestAnimationFrame(() => {
                didDrag.current = true;
              });
            }}
            onDragEnd={clearDrag}
            onClick={() => {
              if (didDrag.current) {
                didDrag.current = false;
                return;
              }
              onWineActivate(wine);
            }}
            className={[
              "flex min-h-[52px] cursor-pointer flex-col items-stretch justify-center gap-0.5 rounded-[6px] border px-0.5 py-1 text-left transition sm:min-h-[58px] sm:rounded-[8px] sm:px-1",
              active || isMoving
                ? "border-[var(--wine)] bg-[rgba(122,36,48,0.12)] slot-active"
                : "border-[rgba(122,36,48,0.18)] bg-[linear-gradient(160deg,rgba(122,36,48,0.14),rgba(255,252,247,0.55))]",
              isOver ? "ring-2 ring-[rgba(110,31,44,0.35)]" : "",
              dimmed ? "opacity-30" : "hover:border-[var(--wine)]",
              isMoving ? "ring-2 ring-[var(--wine)] opacity-95" : "",
              dropReady && !isMoving
                ? "border-dashed border-[var(--wine)]"
                : "",
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
          </button>
        );
      })}
    </>
  );
}
