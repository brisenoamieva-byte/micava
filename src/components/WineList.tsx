"use client";

import type { Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { formatPrice, formatVivino, typeAccent } from "@/lib/wines";

type Props = {
  wines: Wine[];
  selectedId: string | null;
  onSelect: (wine: Wine) => void;
  compact?: boolean;
};

export function WineList({ wines, selectedId, onSelect, compact = false }: Props) {
  if (wines.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-soft">
        Ningún vino coincide con los filtros.
      </p>
    );
  }

  return (
    <div
      className={[
        "min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1",
        compact ? "max-h-[min(62dvh,560px)]" : "max-h-[560px]",
      ].join(" ")}
    >
      {wines.map((wine) => {
        const active = wine.id === selectedId;
        return (
          <button
            key={wine.id}
            type="button"
            onClick={() => onSelect(wine)}
            className={[
              "grid w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[10px] border px-2.5 py-3 text-left transition sm:gap-3 sm:px-3 sm:py-2.5",
              "min-h-[52px]",
              active
                ? "border-[var(--wine)] bg-[rgba(122,36,48,0.08)]"
                : "border-transparent hover:border-[var(--line)] hover:bg-[rgba(255,252,247,0.55)]",
            ].join(" ")}
          >
            <CountryFlag country={wine.country} size="md" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: typeAccent(wine.type) }}
                  title={wine.type}
                />
                <span className="truncate font-medium text-ink">{wine.name}</span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-ink-soft">
                {wine.country} · {wine.region} · {wine.vintage ?? "s/a"}
              </span>
            </span>
            <span className="shrink-0 text-right text-xs text-ink-soft">
              <span className="block font-medium text-ink">{formatVivino(wine.vivino)}</span>
              <span className="block">{formatPrice(wine.price)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
