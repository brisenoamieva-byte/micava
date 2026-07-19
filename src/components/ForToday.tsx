"use client";

import { CountryFlag } from "@/components/CountryFlag";
import type { TodayPick } from "@/lib/suggest-today";
import { formatPrice, formatVivino } from "@/lib/wines";
import type { Wine } from "@/lib/types";

type Props = {
  picks: TodayPick[];
  onSelect: (wine: Wine) => void;
};

export function ForToday({ picks, onSelect }: Props) {
  if (picks.length === 0) return null;

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="display text-2xl text-ink">Para hoy</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Tres opciones listas para abrir — sin pensarlo de más.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {picks.map((pick, i) => (
          <li key={pick.wine.id}>
            <button
              type="button"
              onClick={() => onSelect(pick.wine)}
              className="flex h-full w-full flex-col gap-2 rounded-[12px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] px-3 py-3 text-left transition hover:border-[rgba(110,31,44,0.35)] hover:bg-[rgba(110,31,44,0.06)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Opción {i + 1}
                </span>
                <CountryFlag country={pick.wine.country} size="sm" />
              </div>
              <span className="display text-xl leading-tight text-ink">
                {pick.wine.name}
              </span>
              <span className="text-xs text-ink-soft">
                {pick.wine.winery || pick.wine.region}
                {pick.wine.vintage ? ` · ${pick.wine.vintage}` : ""}
              </span>
              <span className="mt-auto pt-1 text-xs text-ink">
                {formatVivino(pick.wine.vivino)}
                <span className="text-ink-soft">
                  {" "}
                  · {formatPrice(pick.wine.price)}
                </span>
              </span>
              <span className="text-[11px] text-ink-soft">{pick.reason}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
