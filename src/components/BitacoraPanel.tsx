"use client";

import { useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import type { Encounter } from "@/lib/types";
import { formatCavataleRating } from "@/lib/wines";

type Props = {
  entries: Encounter[];
  onRemove?: (id: string) => void;
};

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

export function BitacoraPanel({ entries, onRemove }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = entries.find((e) => e.id === openId) ?? null;

  if (entries.length === 0) {
    return (
      <section className="panel p-4 sm:p-5">
        <h2 className="display text-2xl text-ink">Bitácora</h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          Encuentros en la mesa — historias que no viven en el mapa.
        </p>
        <div className="mt-6 rounded-[12px] border border-dashed border-[var(--line)] px-4 py-8 text-center">
          <p className="display text-xl text-ink">Aún no hay mesas anotadas</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Cuando pidas una botella en un restaurante, ábrela en Encuentro:
            escucha su historia y guárdala aquí — ritual de mesa, no inventario.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel p-4 sm:p-5">
      <h2 className="display text-2xl text-ink">Bitácora</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        Diario de mesas · {entries.length} encuentro
        {entries.length === 1 ? "" : "s"}
      </p>

      <ol className="mt-4 space-y-2">
        {entries.map((e) => {
          const isOpen = openId === e.id;
          return (
            <li key={e.id}>
              <button
                type="button"
                className={[
                  "grid w-full grid-cols-[auto_1fr_auto] items-start gap-2 rounded-[10px] border px-2 py-2.5 text-left transition",
                  isOpen
                    ? "border-[rgba(110,31,44,0.35)] bg-[rgba(110,31,44,0.06)]"
                    : "border-transparent hover:border-[var(--line)] hover:bg-[rgba(255,252,247,0.55)]",
                ].join(" ")}
                onClick={() => setOpenId(isOpen ? null : e.id)}
                aria-expanded={isOpen}
              >
                <CountryFlag country={e.country} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {e.name}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {formatWhen(e.at)}
                    {e.place ? ` · ${e.place}` : ""}
                  </p>
                  {e.note && !isOpen ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink">
                      {e.note}
                    </p>
                  ) : null}
                  {!e.note && e.kimiTalkHook && !isOpen ? (
                    <p className="mt-0.5 line-clamp-1 text-xs italic text-ink-soft">
                      {e.kimiTalkHook}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs text-ink">
                  {e.cavataleRating != null ? (
                    <span className="text-[var(--wine)]">
                      {formatCavataleRating(e.cavataleRating)}
                    </span>
                  ) : (
                    <span className="text-ink-soft">—</span>
                  )}
                </div>
              </button>

              {isOpen && open ? (
                <div className="mt-2 space-y-3 rounded-[10px] border border-[rgba(110,31,44,0.18)] bg-[rgba(255,252,247,0.7)] px-3 py-3">
                  <p className="text-xs text-ink-soft">
                    {[open.winery, open.vintage, open.region || open.country]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {open.place || open.note ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        Esta noche
                      </p>
                      {open.place ? (
                        <p className="mt-1 text-sm text-ink">{open.place}</p>
                      ) : null}
                      {open.note ? (
                        <p className="mt-0.5 text-sm leading-relaxed text-ink">
                          {open.note}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {open.kimiTalkHook ? (
                    <div className="rounded-[10px] border border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] px-2.5 py-2.5">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
                        Para decir en la mesa
                      </p>
                      <p className="mt-1.5 text-[15px] leading-snug text-ink">
                        {open.kimiTalkHook}
                      </p>
                    </div>
                  ) : null}
                  {open.kimiSummary ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        Historia
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink">
                        {open.kimiSummary}
                      </p>
                    </div>
                  ) : null}
                  {open.kimiCuriosity ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        Dato curioso
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink">
                        {open.kimiCuriosity}
                      </p>
                    </div>
                  ) : null}
                  {onRemove ? (
                    <button
                      type="button"
                      className="text-xs text-ink-soft underline-offset-2 hover:text-[var(--wine)] hover:underline"
                      onClick={() => {
                        if (
                          confirm(
                            "¿Quitar este encuentro de tu bitácora? La historia se pierde."
                          )
                        ) {
                          onRemove(open.id);
                          setOpenId(null);
                        }
                      }}
                    >
                      Quitar de la bitácora
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
