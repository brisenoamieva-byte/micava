"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CellarMap } from "@/components/CellarMap";
import { FiltersBar } from "@/components/FiltersBar";
import { ForToday } from "@/components/ForToday";
import { RecentHistory } from "@/components/RecentHistory";
import { StatsDashboard } from "@/components/StatsDashboard";
import { WineDetail } from "@/components/WineDetail";
import { WineFormModal } from "@/components/WineFormModal";
import { WineList } from "@/components/WineList";
import { useCellar } from "@/lib/cellar-store";
import { picksForToday } from "@/lib/suggest-today";
import type { Filters, MatchConfidence, RatingSource, Wine } from "@/lib/types";
import {
  cellarStats,
  filterWines,
  formatPrice,
  formatVivino,
} from "@/lib/wines";

const initialFilters: Filters = {
  query: "",
  country: "",
  type: "",
  grape: "",
  minVivino: null,
  maxVivino: null,
  minPrice: null,
  maxPrice: null,
  sort: "vivino-desc",
};

type MobilePanel = "mapa" | "lista" | "detalle";
type AppMode = "cava" | "stats";

export default function CavaPage() {
  const {
    wines,
    history,
    addWine,
    updateWine,
    verifyWineRating,
    moveWine,
    departWine,
    resetCellar,
  } = useCellar();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("lista");
  const [mode, setMode] = useState<AppMode>("cava");
  const [formOpen, setFormOpen] = useState(false);
  const [formSlot, setFormSlot] = useState("");
  const [editing, setEditing] = useState<Wine | null>(null);

  useEffect(() => {
    if (!selectedId && wines[0]) setSelectedId(wines[0].id);
    if (selectedId && !wines.some((w) => w.id === selectedId)) {
      setSelectedId(wines[0]?.id ?? null);
    }
  }, [wines, selectedId]);

  const visible = useMemo(() => filterWines(wines, filters), [wines, filters]);
  const todayPicks = useMemo(() => picksForToday(wines, 3), [wines]);
  const selected =
    visible.find((w) => w.id === selectedId) ??
    wines.find((w) => w.id === selectedId) ??
    visible[0] ??
    null;

  const stats = cellarStats(visible);

  function selectWine(wine: Wine, goToDetail = false) {
    setSelectedId(wine.id);
    setMode("cava");
    if (goToDetail) setMobilePanel("detalle");
  }

  function openAdd(slot = "") {
    setEditing(null);
    setFormSlot(slot);
    setFormOpen(true);
    setMode("cava");
  }

  function openEdit(wine: Wine) {
    setEditing(wine);
    setFormSlot("");
    setFormOpen(true);
    setMobilePanel("detalle");
  }

  function handleDepart(wine: Wine, action: "opened" | "gifted" | "removed") {
    departWine(wine.id, action);
    setSelectedId((prev) => (prev === wine.id ? null : prev));
    setMobilePanel("lista");
  }

  function handleVerifyRating(
    wine: Wine,
    data: {
      externalRating: number;
      ratingSource: RatingSource;
      matchConfidence: MatchConfidence;
      syncVivino: boolean;
    }
  ) {
    verifyWineRating(
      wine.id,
      {
        externalRating: data.externalRating,
        ratingSource: data.ratingSource,
        lastCheckedAt: new Date().toISOString(),
        matchConfidence: data.matchConfidence,
      },
      { syncVivino: data.syncVivino }
    );
  }

  const detailProps = {
    wine: selected,
    onEdit: openEdit,
    onRemove: (w: Wine) => handleDepart(w, "removed"),
    onOpened: (w: Wine) => handleDepart(w, "opened"),
    onGifted: (w: Wine) => handleDepart(w, "gifted"),
    onVerifyRating: handleVerifyRating,
  };

  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 xl:pb-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/"
              className="display text-[1.85rem] leading-none tracking-tight text-ink sm:text-3xl md:text-4xl"
            >
              Mi Cava
            </Link>
            <p className="mt-1 text-sm text-ink-soft md:text-base">
              Inventario y mapa de tu cava.
            </p>
            <div className="mt-3 inline-flex rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] p-1">
              <button
                type="button"
                className={[
                  "min-h-[36px] rounded-[8px] px-3 text-sm transition",
                  mode === "cava"
                    ? "bg-[rgba(110,31,44,0.12)] font-medium text-ink"
                    : "text-ink-soft",
                ].join(" ")}
                onClick={() => setMode("cava")}
              >
                Cava
              </button>
              <button
                type="button"
                className={[
                  "min-h-[36px] rounded-[8px] px-3 text-sm transition",
                  mode === "stats"
                    ? "bg-[rgba(110,31,44,0.12)] font-medium text-ink"
                    : "text-ink-soft",
                ].join(" ")}
                onClick={() => setMode("stats")}
              >
                Pulso
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
            <span>
              <strong className="text-ink">{stats.bottles}</strong> botellas
            </span>
            <span>
              <strong className="text-ink">{formatPrice(stats.value)}</strong> ref.
            </span>
            <span>
              media <strong className="text-ink">{formatVivino(stats.avgVivino)}</strong>
            </span>
            <button
              type="button"
              className="btn btn-primary min-h-[40px] px-3 text-sm"
              onClick={() => openAdd()}
            >
              + Agregar
            </button>
          </div>
        </header>

        {mode === "stats" ? (
          <div className="mt-6 space-y-5">
            <RecentHistory entries={history} />
            <StatsDashboard
              wines={wines}
              onSelectWine={(w) => selectWine(w, true)}
            />
          </div>
        ) : (
          <>
        <div
          className={[
            "mt-5 space-y-4 sm:mt-6",
            mobilePanel === "detalle" ? "hidden xl:block" : "",
          ].join(" ")}
        >
          <ForToday
            picks={todayPicks}
            onSelect={(w) => selectWine(w, true)}
          />
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            total={visible.length}
            wines={wines}
          />
        </div>

        <div className="desktop-only mt-6">
          <section className="panel p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="display text-2xl text-ink">Mapa de la cava</h2>
              <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
                {stats.emptySlots} libres
              </p>
            </div>
            <CellarMap
              wines={wines}
              highlightedIds={new Set(visible.map((w) => w.id))}
              selectedId={selected?.id ?? null}
              onSelect={(w) => selectWine(w)}
              onEmptySlot={(slot) => openAdd(slot)}
              onMoveWine={moveWine}
            />
          </section>

          <section className="panel flex min-h-[420px] flex-col p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="display text-2xl text-ink">Inventario</h2>
              <p className="text-sm text-ink-soft">{visible.length}</p>
            </div>
            <WineList
              wines={visible}
              selectedId={selected?.id ?? null}
              onSelect={(w) => selectWine(w)}
            />
          </section>

          <section className="panel p-5">
            <WineDetail {...detailProps} />
          </section>
        </div>

        <div className="mobile-only mt-5">
          {mobilePanel === "mapa" && (
            <section className="panel p-3 sm:p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="display text-xl text-ink sm:text-2xl">Mapa de la cava</h2>
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft sm:text-xs">
                  + en huecos
                </p>
              </div>
              <CellarMap
                wines={wines}
                highlightedIds={new Set(visible.map((w) => w.id))}
                selectedId={selected?.id ?? null}
                onSelect={(w) => selectWine(w, true)}
                onEmptySlot={(slot) => openAdd(slot)}
                onMoveWine={moveWine}
              />
            </section>
          )}

          {mobilePanel === "lista" && (
            <section className="panel flex flex-col p-3 sm:p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="display text-xl text-ink sm:text-2xl">Inventario</h2>
                <p className="text-sm text-ink-soft">{visible.length}</p>
              </div>
              <WineList
                wines={visible}
                selectedId={selected?.id ?? null}
                onSelect={(w) => selectWine(w, true)}
                compact
              />
            </section>
          )}

          {mobilePanel === "detalle" && (
            <section className="panel p-4 sm:p-5">
              <WineDetail {...detailProps} />
            </section>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-soft xl:mt-6">
          <button
            type="button"
            className="underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              if (
                confirm(
                  "¿Restaurar la cava al Excel original?\nSe perderán altas y bajas hechas aquí."
                )
              ) {
                resetCellar();
              }
            }}
          >
            Restaurar inventario original
          </button>
          <span>Los cambios se guardan en este navegador.</span>
        </div>
          </>
        )}

        <nav className="mobile-nav" aria-label="Navegación de cava">
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {(
              [
                ["lista", "Lista", "cava"],
                ["mapa", "Mapa", "cava"],
                ["detalle", "Detalle", "cava"],
                ["stats", "Pulso", "stats"],
              ] as const
            ).map(([id, label, targetMode]) => (
              <button
                key={id}
                type="button"
                className="mobile-nav-btn"
                aria-current={
                  targetMode === "stats"
                    ? mode === "stats"
                      ? "page"
                      : undefined
                    : mode === "cava" && mobilePanel === id
                      ? "page"
                      : undefined
                }
                onClick={() => {
                  if (targetMode === "stats") setMode("stats");
                  else {
                    setMode("cava");
                    setMobilePanel(id as MobilePanel);
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <WineFormModal
        open={formOpen}
        wines={wines}
        initialSlot={formSlot}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setFormSlot("");
        }}
        onSubmit={(draft) => {
          if (editing) {
            updateWine(editing.id, draft);
            setSelectedId(editing.id);
          } else {
            const created = addWine(draft);
            setSelectedId(created.id);
            setMobilePanel("detalle");
          }
        }}
      />
    </main>
  );
}
