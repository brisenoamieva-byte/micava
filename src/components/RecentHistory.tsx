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

function stars(n: number | null): string {
  if (n == null) return "";
  return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}

export function RecentHistory({ entries }: Props) {
  if (entries.length === 0) return null;

  const favorites = entries
    .filter((e) => e.action === "opened" && (e.myRating ?? 0) >= 4)
    .slice(0, 5);

  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="display text-2xl text-ink">Reciente</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Lo que salió de la cava — con tu nota para recordar qué repetir.
      </p>

      {favorites.length > 0 ? (
        <div className="mt-4 rounded-[10px] border border-[rgba(110,31,44,0.2)] bg-[rgba(110,31,44,0.05)] p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Me gustaron (4–5)
          </p>
          <ul className="mt-2 space-y-1.5">
            {favorites.map((e) => (
              <li key={`fav-${e.id}`} className="text-sm text-ink">
                <span className="font-medium">{e.wine.name}</span>
                <span className="ml-2 text-xs text-[var(--wine)]">
                  {stars(e.myRating)}
                </span>
                {e.note ? (
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {e.note}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="mt-4 space-y-2">
        {entries.slice(0, 10).map((e) => (
          <li
            key={e.id}
            className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-[10px] border border-transparent px-1 py-2"
          >
            <CountryFlag country={e.wine.country} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {e.wine.name}
              </p>
              <p className="truncate text-xs text-ink-soft">
                {actionLabel[e.action]} · {formatWhen(e.at)}
                {e.myRating != null ? ` · ${stars(e.myRating)}` : ""}
              </p>
              {e.note ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink">
                  {e.note}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 text-right text-xs text-ink">
              Calif. V {formatVivino(e.wine.vivino)}
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
