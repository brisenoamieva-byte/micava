"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const STORAGE_KEY = "micava.desktop.cols.v1";
/** Map % · Inventario % · Detalle % — inventario más ancho por defecto */
const DEFAULT_COLS = [40, 34, 26] as const;
const MIN = [28, 22, 20];

type Props = {
  map: ReactNode;
  inventory: ReactNode;
  detail: ReactNode;
};

function loadCols(): [number, number, number] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_COLS];
    const parsed = JSON.parse(raw) as number[];
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.every((n) => typeof n === "number" && n > 0)
    ) {
      const sum = parsed[0] + parsed[1] + parsed[2];
      return [
        (parsed[0] / sum) * 100,
        (parsed[1] / sum) * 100,
        (parsed[2] / sum) * 100,
      ];
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_COLS];
}

export function ResizableDesktopPanels({ map, inventory, detail }: Props) {
  const [cols, setCols] = useState<[number, number, number] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    index: 0 | 1;
    startX: number;
    startCols: [number, number, number];
  } | null>(null);

  useEffect(() => {
    setCols(loadCols());
  }, []);

  useEffect(() => {
    if (!cols) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
  }, [cols]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    const el = wrapRef.current;
    if (!drag || !el) return;
    const width = el.getBoundingClientRect().width;
    if (width < 1) return;
    const deltaPct = ((e.clientX - drag.startX) / width) * 100;
    const next: [number, number, number] = [...drag.startCols];

    if (drag.index === 0) {
      let a = drag.startCols[0] + deltaPct;
      let b = drag.startCols[1] - deltaPct;
      if (a < MIN[0]) {
        b -= MIN[0] - a;
        a = MIN[0];
      }
      if (b < MIN[1]) {
        a -= MIN[1] - b;
        b = MIN[1];
      }
      next[0] = a;
      next[1] = b;
    } else {
      let b = drag.startCols[1] + deltaPct;
      let c = drag.startCols[2] - deltaPct;
      if (b < MIN[1]) {
        c -= MIN[1] - b;
        b = MIN[1];
      }
      if (c < MIN[2]) {
        b -= MIN[2] - c;
        c = MIN[2];
      }
      next[1] = b;
      next[2] = c;
    }
    setCols(next);
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMove]);

  function startDrag(index: 0 | 1, e: ReactPointerEvent) {
    if (!cols) return;
    e.preventDefault();
    dragRef.current = {
      index,
      startX: e.clientX,
      startCols: [...cols],
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  }

  function reset() {
    setCols([...DEFAULT_COLS]);
  }

  // Wait for local widths so we don't flash default → saved (layout jump).
  if (!cols) {
    return <div className="desktop-only mt-6 min-h-[480px]" aria-hidden />;
  }

  return (
    <div className="desktop-panels-host desktop-only mt-6 h-full min-h-0 flex-1">
      <div
        ref={wrapRef}
        className="desktop-panels min-h-0 flex-1"
        style={{
          gridTemplateColumns: `${cols[0]}fr ${cols[1]}fr ${cols[2]}fr`,
        }}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col">{map}</div>

        <div className="relative flex h-full min-h-0 min-w-0 flex-col">
          <button
            type="button"
            aria-label="Redimensionar mapa e inventario"
            title="Arrastra para ampliar o reducir"
            className="desktop-resize-handle"
            onPointerDown={(e) => startDrag(0, e)}
          />
          {inventory}
        </div>

        <div className="relative flex h-full min-h-0 min-w-0 flex-col">
          <button
            type="button"
            aria-label="Redimensionar inventario y detalle"
            title="Arrastra para ampliar o reducir"
            className="desktop-resize-handle"
            onPointerDown={(e) => startDrag(1, e)}
          />
          {detail}
        </div>
      </div>
      <p className="mt-2 shrink-0 text-right text-[11px] text-ink-soft">
        Arrastra los bordes entre paneles para ajustar anchos ·{" "}
        <button
          type="button"
          className="underline-offset-2 hover:text-ink hover:underline"
          onClick={reset}
        >
          Restablecer
        </button>
      </p>
    </div>
  );
}
