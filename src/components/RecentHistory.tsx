"use client";

import { CountryFlag } from "@/components/CountryFlag";
import type { CellarLogEntry } from "@/lib/types";
import { formatPrice, formatVivino } from "@/lib/wines";

type Props = {
  entries: CellarLogEntry[];
};

const actionLabel = {
  opened: "Abriste",
  gifted: "Regalaste",
  removed: "Quitaste",
} as const;

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function RecentHistory({ entries }: Props) {
  if (entries.length === 0) return null;

  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="display text-2xl text-ink">Reciente</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Lo que salió de la cava — abrir, regalar o quitar.
      </p>
      <ol className="mt-4 space-y-2">
        {entries.slice(0, 8).map((e) => (
          <li
            key={e.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[10px] border border-transparent px-1 py-2"
          >
            <CountryFlag country={e.wine.country} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {e.wine.name}
              </p>
              <p className="truncate text-xs text-ink-soft">
                {actionLabel[e.action]} · {formatWhen(e.at)}
              </p>
            </div>
            <div className="shrink-0 text-right text-xs text-ink">
              {formatVivino(e.wine.vivino)}
              <span className="mt-0.5 block text-ink-soft">
                {formatPrice(e.wine.price)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
