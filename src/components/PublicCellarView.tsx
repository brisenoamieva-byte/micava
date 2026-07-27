"use client";

import { useMemo, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import type { NetworkProfile, PublicWine } from "@/lib/network";
import { placeLabel } from "@/lib/network";
import {
  formatCavataleRating,
  formatVivino,
  typeAccent,
} from "@/lib/wines";

type BrowseMode = "pais" | "tipo" | "destacados";

const TYPE_ORDER = ["Tinto", "Blanco", "Rosado", "Espumoso"];

type Props = {
  profile: NetworkProfile;
  wines: PublicWine[];
  loading?: boolean;
  onBack: () => void;
};

function wineSearchHaystack(w: PublicWine): string {
  return [w.name, w.winery, w.grape, w.country, w.region, w.type]
    .join(" ")
    .toLowerCase();
}

function ratingScore(w: PublicWine): number {
  if (w.cavatale_rating != null) return w.cavatale_rating;
  if (w.vivino != null) return w.vivino;
  return -1;
}

function sortByName(a: PublicWine, b: PublicWine): number {
  return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}

function typeSortKey(type: string): number {
  const i = TYPE_ORDER.findIndex(
    (t) => t.toLowerCase() === type.trim().toLowerCase()
  );
  return i === -1 ? TYPE_ORDER.length : i;
}

export function PublicCellarView({
  profile,
  wines,
  loading,
  onBack,
}: Props) {
  const [mode, setMode] = useState<BrowseMode>("pais");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wines;
    return wines.filter((w) => wineSearchHaystack(w).includes(q));
  }, [wines, query]);

  const summary = useMemo(() => {
    const countries = new Set(
      filtered.map((w) => w.country.trim()).filter(Boolean)
    );
    const rated = filtered.filter((w) => w.cavatale_rating != null);
    const avgCavatale =
      rated.length === 0
        ? null
        : rated.reduce((s, w) => s + (w.cavatale_rating ?? 0), 0) /
          rated.length;
    const typeCounts = new Map<string, number>();
    for (const w of filtered) {
      const t = w.type.trim() || "Otro";
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
    const topTypes = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .slice(0, 3)
      .map(([t, n]) => `${t} (${n})`);
    return {
      bottles: filtered.length,
      countries: countries.size,
      avgCavatale,
      topTypes,
    };
  }, [filtered]);

  const byCountry = useMemo(() => {
    const map = new Map<string, PublicWine[]>();
    for (const w of filtered) {
      const key = w.country.trim() || "Sin país";
      const list = map.get(key) ?? [];
      list.push(w);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort(sortByName);
    return [...map.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "es", { sensitivity: "base" })
    );
  }, [filtered]);

  const byType = useMemo(() => {
    const map = new Map<string, PublicWine[]>();
    for (const w of filtered) {
      const key = w.type.trim() || "Otro";
      const list = map.get(key) ?? [];
      list.push(w);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort(sortByName);
    return [...map.entries()].sort((a, b) => {
      const d = typeSortKey(a[0]) - typeSortKey(b[0]);
      if (d !== 0) return d;
      return a[0].localeCompare(b[0], "es", { sensitivity: "base" });
    });
  }, [filtered]);

  const destacados = useMemo(() => {
    return [...filtered]
      .filter((w) => ratingScore(w) >= 0)
      .sort((a, b) => ratingScore(b) - ratingScore(a) || sortByName(a, b))
      .slice(0, 12);
  }, [filtered]);

  const displayName = profile.display_name?.trim() || "Coleccionista";

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <button
          type="button"
          className="text-sm text-[var(--wine)] underline-offset-2 hover:underline"
          onClick={onBack}
        >
          ← Directorio
        </button>
        <div>
          <h3 className="display text-2xl text-ink">{displayName}</h3>
          <p className="mt-0.5 text-sm text-ink-soft">{placeLabel(profile)}</p>
          {profile.bio ? (
            <p className="mt-2 text-sm text-ink-soft">{profile.bio}</p>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-ink-soft">Cargando cava…</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3 text-xs text-ink-soft">
            <span>
              <strong className="text-ink">{summary.bottles}</strong> botellas
            </span>
            <span>
              <strong className="text-ink">{summary.countries}</strong> países
            </span>
            <span>
              Media Cavatale{" "}
              <strong className="text-ink">
                {formatCavataleRating(summary.avgCavatale)}
              </strong>
            </span>
            {summary.topTypes.length > 0 ? (
              <span className="w-full sm:w-auto">
                Tipos: {summary.topTypes.join(" · ")}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {!loading ? (
        <div className="panel space-y-4 p-5">
          <label className="block text-sm text-ink-soft">
            Buscar en esta cava
            <input
              className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, bodega o uva"
            />
          </label>

          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Clasificación"
          >
            {(
              [
                ["pais", "Por país"],
                ["tipo", "Por tipo"],
                ["destacados", "Destacados"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={[
                  "btn min-h-[40px] px-3 text-sm",
                  mode === id ? "btn-primary" : "btn-ghost",
                ].join(" ")}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="py-6 text-sm text-ink-soft">
              {wines.length === 0
                ? "Esta cava pública aún no tiene botellas."
                : "Ningún vino coincide con la búsqueda."}
            </p>
          ) : mode === "destacados" ? (
            destacados.length === 0 ? (
              <p className="py-6 text-sm text-ink-soft">
                Aún no hay calificaciones para destacar.
              </p>
            ) : (
              <WineGroupList wines={destacados} />
            )
          ) : mode === "tipo" ? (
            <div className="space-y-5">
              {byType.map(([type, list]) => (
                <section key={type}>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: typeAccent(type) }}
                      aria-hidden
                    />
                    {type}
                    <span className="font-normal text-ink-soft">
                      ({list.length})
                    </span>
                  </h4>
                  <WineGroupList wines={list} />
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {byCountry.map(([country, list]) => (
                <section key={country}>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                    {country !== "Sin país" ? (
                      <CountryFlag country={country} size="sm" />
                    ) : null}
                    {country}
                    <span className="font-normal text-ink-soft">
                      ({list.length})
                    </span>
                  </h4>
                  <WineGroupList wines={list} />
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <p className="px-1 text-xs text-ink-soft">
        Solo vinos y calificaciones. Sin precios ni mapa de la cava.
      </p>
    </div>
  );
}

function WineGroupList({ wines }: { wines: PublicWine[] }) {
  return (
    <ul className="divide-y divide-[var(--line)]">
      {wines.map((w) => (
        <li key={w.id} className="flex items-start gap-2.5 py-2.5">
          <CountryFlag country={w.country} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-medium text-ink">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: typeAccent(w.type) }}
                title={w.type}
              />
              <span className="truncate">{w.name}</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {[w.winery, w.vintage ?? "s/a", w.country, w.type, w.grape]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="shrink-0 text-right text-xs text-ink-soft">
            {w.cavatale_rating != null ? (
              <p className="font-medium text-ink">
                Cavatale {formatCavataleRating(w.cavatale_rating)}
              </p>
            ) : null}
            {w.vivino != null ? (
              <p className={w.cavatale_rating != null ? "" : "font-medium text-ink"}>
                Vivino {formatVivino(w.vivino)}
              </p>
            ) : w.cavatale_rating == null ? (
              <p>—</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
