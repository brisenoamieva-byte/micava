"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CellarLogEntry, CellarUnit, Wine } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { buildInsights, qualityScore, type ReplenishItem } from "@/lib/analytics";
import { formatCavataleRating, formatPrice, formatVivino, typeAccent } from "@/lib/wines";

type Props = {
  wines: Wine[];
  cellars?: CellarUnit[];
  history?: CellarLogEntry[];
  onSelectWine?: (wine: Wine) => void;
};

export function StatsDashboard({
  wines,
  cellars = [],
  history = [],
  onSelectWine,
}: Props) {
  const insights = useMemo(
    () => buildInsights(wines, cellars, history),
    [wines, cellars, history]
  );
  const maxCountry = Math.max(...insights.byCountry.map((c) => c.count), 1);
  const maxVintage = Math.max(...insights.vintages.map((v) => v.count), 1);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const vintageWines = useMemo(() => {
    if (selectedYear == null) return [];
    return wines
      .filter((w) => w.vintage === selectedYear)
      .sort(
        (a, b) =>
          (qualityScore(b) ?? 0) - (qualityScore(a) ?? 0) ||
          a.name.localeCompare(b.name, "es")
      );
  }, [wines, selectedYear]);

  const regionWines = useMemo(() => {
    if (selectedRegion == null) return [];
    return wines
      .filter((w) => (w.region || "") === selectedRegion)
      .sort(
        (a, b) =>
          (qualityScore(b) ?? 0) - (qualityScore(a) ?? 0) ||
          a.name.localeCompare(b.name, "es")
      );
  }, [wines, selectedRegion]);

  const countryWines = useMemo(() => {
    if (selectedCountry == null) return [];
    return wines
      .filter((w) => (w.country || "") === selectedCountry)
      .sort(
        (a, b) =>
          (qualityScore(b) ?? 0) - (qualityScore(a) ?? 0) ||
          a.name.localeCompare(b.name, "es")
      );
  }, [wines, selectedCountry]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="display text-3xl text-ink md:text-4xl">Pulso de la cava</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft md:text-base">
            Una lectura rápida de origen, calidad, valor y huecos — para decidir
            qué abrir, qué regalar y qué reponer.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Botellas"
          value={String(insights.bottles)}
          hint={`${insights.countries} países`}
        />
        <Kpi
          label="Valor ref."
          value={formatPrice(insights.value)}
          hint={
            insights.avgPrice != null
              ? `prom. ${formatPrice(insights.avgPrice)}`
              : "—"
          }
        />
        <Kpi
          label="Media calif. Cavatale"
          value={formatCavataleRating(insights.avgCavatale)}
          hint={
            insights.avgCavatale != null
              ? "solo botellas con calificación Cavatale"
              : "cuenta la historia de un vino"
          }
        />
        <div className="panel col-span-2 flex items-center gap-4 p-4 lg:col-span-1">
          <OccupancyRing value={insights.occupancy} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Ocupación
            </p>
            <p className="display mt-1 text-2xl leading-none text-ink">
              {Math.round(insights.occupancy * 100)}%
            </p>
            <p className="mt-1.5 text-xs text-ink-soft">
              {insights.totalSlots - insights.emptySlots} de {insights.totalSlots}
              {" · "}
              {insights.occupancyLabel}
            </p>
          </div>
        </div>
      </section>

      {insights.toReplenish.length > 0 ? (
        <ReplenishBlock items={insights.toReplenish} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {/* País */}
        <section className="panel p-4 sm:p-5">
          <Header
            title="Por país"
            subtitle="Cantidad y peso en el inventario · toca un país"
          />
          <div className="mt-4 space-y-1.5">
            {insights.byCountry.map((c, i) => {
              const active = selectedCountry === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() =>
                    setSelectedCountry((prev) =>
                      prev === c.name ? null : c.name
                    )
                  }
                  aria-pressed={active}
                  className={[
                    "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[10px] px-2 py-2 text-left transition",
                    active
                      ? "bg-[rgba(110,31,44,0.1)]"
                      : "hover:bg-[rgba(26,23,20,0.04)]",
                  ].join(" ")}
                >
                  <CountryFlag country={c.name} size="sm" />
                  <div className="min-w-0">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">
                        {c.name}
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {c.count} · {Math.round(c.share * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[rgba(26,23,20,0.08)]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(c.count / maxCountry) * 100}%`,
                          background:
                            i === 0
                              ? "var(--wine)"
                              : i === 1
                                ? "var(--wine-soft)"
                                : "var(--oak)",
                        }}
                      />
                    </div>
                  </div>
                  <span className="hidden text-right text-xs text-ink-soft sm:block">
                    {formatPrice(c.value)}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedCountry != null ? (
            <DrilldownList
              title={
                <>
                  País <strong>{selectedCountry}</strong>
                </>
              }
              wines={countryWines}
              onClose={() => setSelectedCountry(null)}
              onSelectWine={onSelectWine}
              subtitle={(w) =>
                `${w.winery || w.region}${w.vintage ? ` · ${w.vintage}` : ""}${w.slot ? ` · ${w.slot}` : ""}`
              }
            />
          ) : null}
        </section>

        {/* Tipo donut + bands */}
        <section className="panel p-4 sm:p-5">
          <Header title="Perfil" subtitle="Tipo, calificación Cavatale y rangos de precio" />
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <TypeDonut items={insights.byType} total={insights.bottles} />
            <div className="w-full flex-1 space-y-5">
              <BandBlock
                title="Calificación Cavatale"
                emptyHint="Cuenta la historia de un vino para ver bandas"
                bands={insights.cavataleBands}
                color="var(--wine)"
              />
              <BandBlock title="Precio" bands={insights.priceBands} color="var(--oak)" />
            </div>
          </div>
        </section>
      </div>

      {/* Vintages */}
      <section className="panel p-4 sm:p-5">
        <Header title="Añadas en cava" subtitle="Cuántas botellas por año de cosecha · toca una barra" />
        {insights.vintages.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Sin años registrados.</p>
        ) : (
          <>
            <div className="mt-5 flex items-end gap-1.5 overflow-x-auto pb-1 sm:gap-2">
              {insights.vintages.map((v) => {
                const active = selectedYear === v.year;
                return (
                  <button
                    key={v.year}
                    type="button"
                    onClick={() =>
                      setSelectedYear((prev) => (prev === v.year ? null : v.year))
                    }
                    className={[
                      "flex min-w-[2.1rem] flex-col items-center gap-1.5 rounded-[8px] px-0.5 py-1 transition",
                      active
                        ? "bg-[rgba(110,31,44,0.1)]"
                        : "hover:bg-[rgba(26,23,20,0.04)]",
                    ].join(" ")}
                    aria-pressed={active}
                    aria-label={`Añada ${v.year}, ${v.count} botellas`}
                  >
                    <span className="text-[10px] font-medium text-ink">{v.count}</span>
                    <div
                      className={[
                        "w-full rounded-t-[6px] transition-all duration-700",
                        active ? "bg-[var(--wine)]" : "bg-[var(--wine)]/85",
                      ].join(" ")}
                      style={{
                        height: `${Math.max(12, (v.count / maxVintage) * 120)}px`,
                      }}
                    />
                    <span
                      className={[
                        "text-[10px]",
                        active ? "font-medium text-ink" : "text-ink-soft",
                      ].join(" ")}
                    >
                      {String(v.year).slice(2)}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedYear != null ? (
              <DrilldownList
                title={
                  <>
                    Añada <strong>{selectedYear}</strong>
                  </>
                }
                wines={vintageWines}
                onClose={() => setSelectedYear(null)}
                onSelectWine={onSelectWine}
                subtitle={(w) =>
                  `${w.winery || w.region}${w.slot ? ` · ${w.slot}` : ""}`
                }
              />
            ) : null}
          </>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <RankList
          title="Mejor calificados"
          subtitle="Calificación Cavatale primero; si falta, calificación Vivino"
          wines={insights.topByCavatale}
          metric={(w) =>
            w.cavataleRating != null
              ? `Calif. C ${formatCavataleRating(w.cavataleRating)}`
              : `Calif. V ${formatVivino(w.vivino)}`
          }
          onSelect={onSelectWine}
        />
        <RankList
          title="Mayor valor"
          subtitle="Precio de referencia en MXN"
          wines={insights.topByPrice}
          metric={(w) => formatPrice(w.price)}
          onSelect={onSelectWine}
        />
      </div>

      {/* Regiones */}
      <section className="panel p-4 sm:p-5">
        <Header
          title="Regiones con más botellas"
          subtitle="Dónde se concentra tu cava · toca una región"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {insights.byRegion.map((r) => {
            const active = selectedRegion === r.name;
            return (
              <button
                key={r.name || "__empty"}
                type="button"
                onClick={() =>
                  setSelectedRegion((prev) => (prev === r.name ? null : r.name))
                }
                aria-pressed={active}
                className={[
                  "inline-flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm transition",
                  active
                    ? "border-[rgba(110,31,44,0.35)] bg-[rgba(110,31,44,0.1)]"
                    : "border-[var(--line)] bg-[rgba(255,252,247,0.55)] hover:border-[rgba(110,31,44,0.25)]",
                ].join(" ")}
              >
                <span className="font-medium text-ink">
                  {r.name || "Sin región"}
                </span>
                <span className="text-ink-soft">{r.count}</span>
              </button>
            );
          })}
        </div>
        {selectedRegion != null ? (
          <DrilldownList
            title={
              <>
                Región <strong>{selectedRegion || "Sin región"}</strong>
              </>
            }
            wines={regionWines}
            onClose={() => setSelectedRegion(null)}
            onSelectWine={onSelectWine}
            subtitle={(w) =>
              `${w.winery || w.country}${w.vintage ? ` · ${w.vintage}` : ""}${w.slot ? ` · ${w.slot}` : ""}`
            }
          />
        ) : null}
      </section>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="display text-2xl text-ink">{title}</h3>
      <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>
    </div>
  );
}

function stars(n: number): string {
  return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}

function ReplenishBlock({ items }: { items: ReplenishItem[] }) {
  return (
    <section className="panel p-4 sm:p-5">
      <Header
        title="Para reponer"
        subtitle="Los que te gustaron (4–5★) y ya no tienes — o solo queda una"
      />
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={`${item.name}|${item.winery}`}
            className="grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-[10px] border border-transparent px-1 py-2"
          >
            <CountryFlag country={item.country} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{item.name}</p>
              <p className="truncate text-xs text-ink-soft">
                {item.winery || "Sin bodega"}
                <span className="ml-2 text-[var(--wine)]">{stars(item.myRating)}</span>
              </p>
              {item.note ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink">{item.note}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-right text-xs text-ink-soft">
              {item.inStock === 0 ? "Agotado" : "Última"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DrilldownList({
  title,
  wines,
  onClose,
  onSelectWine,
  subtitle,
}: {
  title: ReactNode;
  wines: Wine[];
  onClose: () => void;
  onSelectWine?: (wine: Wine) => void;
  subtitle: (w: Wine) => string;
}) {
  return (
    <div className="mt-5 border-t border-[var(--line)] pt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink">
          {title}
          <span className="text-ink-soft"> · {wines.length}</span>
        </p>
        <button
          type="button"
          className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
      <ul className="space-y-1">
        {wines.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => onSelectWine?.(w)}
              className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[10px] border border-transparent px-1 py-2 text-left transition hover:border-[var(--line)] hover:bg-[rgba(255,252,247,0.55)]"
            >
              <CountryFlag country={w.country} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">
                  {w.name}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {subtitle(w)}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs font-medium text-ink">
                {w.cavataleRating != null
                  ? `Calif. C ${formatCavataleRating(w.cavataleRating)}`
                  : `Calif. V ${formatVivino(w.vivino)}`}
                <span className="mt-0.5 block font-normal text-ink-soft">
                  {formatPrice(w.price)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className="display mt-1 text-2xl leading-none text-ink md:text-3xl">{value}</p>
      <p className="mt-2 text-xs text-ink-soft">{hint}</p>
    </div>
  );
}

function OccupancyRing({ value }: { value: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, value)));
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(26,23,20,0.1)" strokeWidth="7" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="var(--wine)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        className="transition-all duration-700"
      />
    </svg>
  );
}

function TypeDonut({
  items,
  total,
}: {
  items: { name: string; count: number; share: number }[];
  total: number;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  let cursor = 0;
  return (
    <div className="shrink-0">
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        className="mx-auto block"
        aria-hidden
      >
        <g transform="rotate(-90 70 70)">
          {items.map((item) => {
            const len = c * item.share;
            const dash = `${len} ${c - len}`;
            const el = (
              <circle
                key={item.name}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={typeAccent(item.name)}
                strokeWidth="16"
                strokeDasharray={dash}
                strokeDashoffset={-cursor}
                className="transition-all duration-700"
              />
            );
            cursor += len;
            return el;
          })}
        </g>
        {/* SVG text stays unrotated; pair optically centered in the hole */}
        <text
          x="70"
          y="64"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--ink)"
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: 32,
            fontWeight: 500,
          }}
        >
          {total}
        </text>
        <text
          x="70"
          y="82"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--ink-soft)"
          style={{
            fontFamily: "var(--font-outfit), system-ui, sans-serif",
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          total
        </text>
      </svg>
      <ul className="mt-3 space-y-1">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-xs text-ink-soft">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: typeAccent(item.name) }}
            />
            {item.name} · {item.count}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BandBlock({
  title,
  bands,
  color,
  emptyHint,
}: {
  title: string;
  bands: { label: string; count: number; share: number }[];
  color: string;
  emptyHint?: string;
}) {
  const total = bands.reduce((s, b) => s + b.count, 0);
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">{title}</p>
      {total === 0 && emptyHint ? (
        <p className="text-xs text-ink-soft">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {bands.map((b) => (
            <div key={b.label}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="text-ink">{b.label}</span>
                <span className="text-ink-soft">{b.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(26,23,20,0.08)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${b.share * 100}%`, background: color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RankList({
  title,
  subtitle,
  wines,
  metric,
  onSelect,
}: {
  title: string;
  subtitle: string;
  wines: Wine[];
  metric: (w: Wine) => string;
  onSelect?: (wine: Wine) => void;
}) {
  return (
    <section className="panel p-4 sm:p-5">
      <Header title={title} subtitle={subtitle} />
      <ol className="mt-4 space-y-2">
        {wines.length === 0 ? (
          <li className="text-sm text-ink-soft">Sin coincidencias aún.</li>
        ) : (
          wines.map((w, i) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onSelect?.(w)}
                className="grid w-full grid-cols-[1.5rem_auto_1fr_auto] items-center gap-2 rounded-[10px] border border-transparent px-1 py-2 text-left transition hover:border-[var(--line)] hover:bg-[rgba(255,252,247,0.55)]"
              >
                <span className="text-sm text-ink-soft">{i + 1}</span>
                <CountryFlag country={w.country} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{w.name}</span>
                  <span className="block truncate text-xs text-ink-soft">
                    {w.region} · {w.vintage ?? "s/a"}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs font-medium text-ink">
                  {metric(w)}
                </span>
              </button>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}
