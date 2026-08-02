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

function storyPreview(e: Encounter): string | null {
  return e.kimiTalkHook || e.kimiSummary || null;
}

export function BitacoraPanel({ entries, onRemove }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = entries.find((e) => e.id === openId) ?? null;

  if (entries.length === 0) {
    return (
      <section className="panel-quiet p-4 sm:p-5">
        <h2 className="display text-2xl text-ink">Bitácora</h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          Historias de botellas que escaneaste — fuera del mapa.
        </p>
        <div className="mt-6 rounded-[12px] border border-dashed border-[var(--line)] px-4 py-8 text-center">
          <p className="display text-xl text-ink">Aún no hay historias</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            En Escanear botella identifica el vino, cuenta su historia y
            guárdala aquí con un toque.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel-quiet p-4 sm:p-5">
      <h2 className="display text-2xl text-ink">Bitácora</h2>
      <p className="mt-0.5 text-sm text-ink-soft">
        {entries.length} historia{entries.length === 1 ? "" : "s"}
      </p>

      <ol className="mt-4 space-y-2">
        {entries.map((e) => {
          const isOpen = openId === e.id;
          const preview = storyPreview(e);
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
                    {[e.winery, formatWhen(e.at)].filter(Boolean).join(" · ")}
                  </p>
                  {preview && !isOpen ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">
                      {preview}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs text-ink">
                  {e.cavataleRating != null ? (
                    <span className="text-[var(--wine)]">
                      {formatCavataleRating(e.cavataleRating)}
                    </span>
                  ) : null}
                </div>
              </button>

              {isOpen && open ? (
                <div className="mt-2 space-y-3 rounded-[10px] border border-[rgba(110,31,44,0.18)] bg-[rgba(255,252,247,0.7)] px-3 py-3">
                  <p className="text-xs text-ink-soft">
                    {[open.winery, open.vintage, open.region || open.country]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {open.cavataleRating != null ? (
                    <p className="text-sm text-[var(--wine)]">
                      Cavatale {formatCavataleRating(open.cavataleRating)}
                    </p>
                  ) : null}
                  {open.kimiTalkHook ? (
                    <div className="tale-hook px-2.5 py-2.5">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
                        Para contar
                      </p>
                      <p className="display mt-1.5 text-[1.15rem] leading-snug">
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
                            "¿Quitar esta historia de tu bitácora? Se pierde."
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
