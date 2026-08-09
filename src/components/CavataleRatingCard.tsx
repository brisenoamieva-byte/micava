"use client";

import { useState } from "react";
import {
  buildCavataleAxisBreakdown,
  CAVATALE_EVIDENCE_KEYS,
  type CavataleAxisBreakdownRow,
  type CavataleAxisKey,
  type CavataleRatingEvidence,
  type CavataleRatingParts,
} from "@/lib/cavatale-rating";
import { useT } from "@/lib/i18n";
import { formatCavataleRating } from "@/lib/wines";

type Props = {
  rating: number;
  parts?: CavataleRatingParts | null;
  evidence?: CavataleRatingEvidence | null;
  /** Compact rubric line under the total. */
  rubric?: string;
};

/** Wine-toned fills for the axes (monochrome progression, not a rainbow). */
const AXIS_FILL: Record<CavataleAxisKey, string> = {
  market: "var(--ink)",
  taste: "var(--wine-deep)",
  originality: "var(--wine)",
  story: "var(--wine-soft)",
  table: "rgba(106, 26, 40, 0.38)",
};

/**
 * Official Cavatale score — compact by default; methodology behind one toggle.
 */
export function CavataleRatingCard({
  rating,
  parts,
  evidence,
  rubric,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rows = parts ? buildCavataleAxisBreakdown(parts) : null;
  const contributionTotal =
    rows?.reduce((sum, row) => sum + Math.max(0, row.contribution), 0) ?? 0;
  const hasDetails = Boolean(rows || evidence);

  return (
    <div className="rounded-[10px] border border-[rgba(110,31,44,0.28)] bg-[rgba(110,31,44,0.08)] px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
        {t("wine.rating")}
      </p>
      <p className="display mt-1 text-3xl leading-none text-ink">
        {formatCavataleRating(rating)}
      </p>
      <p className="mt-1.5 text-xs text-ink-soft">
        {rubric ?? t("wine.cavataleRubric")}
      </p>

      {hasDetails ? (
        <button
          type="button"
          className="mt-3 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open
            ? t("wine.cavataleBreakdown.hideHow")
            : t("wine.cavataleBreakdown.howWeScore")}
        </button>
      ) : null}

      {open && rows ? (
        <div className="mt-3 space-y-3 border-t border-[rgba(110,31,44,0.16)] pt-3">
          <CompositionStrip
            rows={rows}
            contributionTotal={contributionTotal}
            label={t("wine.cavataleBreakdown.composeLabel")}
            axisLabel={(key) => t(`wine.cavataleBreakdown.axes.${key}`)}
          />

          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm text-ink">
                  <span className="font-medium">
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle"
                      style={{ background: AXIS_FILL[row.key] }}
                      aria-hidden
                    />
                    {t(`wine.cavataleBreakdown.axes.${row.key}`)}
                    <span className="ml-1 font-normal text-ink-soft">
                      {Math.round(row.weight * 100)}%
                    </span>
                  </span>
                  <span className="tabular-nums text-ink">
                    {formatCavataleRating(row.score)}
                  </span>
                </div>
                <div
                  className="cavatale-axis-track mt-1.5"
                  role="meter"
                  aria-valuemin={1}
                  aria-valuemax={5}
                  aria-valuenow={row.score}
                  aria-label={`${t(`wine.cavataleBreakdown.axes.${row.key}`)} ${formatCavataleRating(row.score)}`}
                >
                  <div
                    className="cavatale-axis-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, (row.score / 5) * 100))}%`,
                      background: AXIS_FILL[row.key],
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open && evidence ? (
        <div className="mt-3 space-y-1.5 border-t border-[rgba(110,31,44,0.16)] pt-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {t("wine.cavataleBreakdown.evidenceTitle")}
          </p>
          <ul className="space-y-1.5">
            {CAVATALE_EVIDENCE_KEYS.map((key) => {
              const value = evidence[key];
              return (
                <li
                  key={key}
                  className="flex items-start justify-between gap-2 text-xs leading-snug"
                >
                  <span className="shrink-0 text-ink-soft">
                    {t(`wine.cavataleBreakdown.evidence.${key}`)}
                  </span>
                  <span className="min-w-0 text-right text-ink">
                    {t(`wine.cavataleBreakdown.values.${key}.${value}`)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CompositionStrip({
  rows,
  contributionTotal,
  label,
  axisLabel,
}: {
  rows: CavataleAxisBreakdownRow[];
  contributionTotal: number;
  label: string;
  axisLabel: (key: CavataleAxisKey) => string;
}) {
  const total = contributionTotal > 0 ? contributionTotal : 1;
  const summary = rows
    .map(
      (row) =>
        `${axisLabel(row.key)} ${Math.round((row.contribution / total) * 100)}%`
    )
    .join(", ");

  return (
    <div>
      <p className="mb-1.5 text-xs text-ink-soft">{label}</p>
      <div
        className="cavatale-compose"
        role="img"
        aria-label={`${label}: ${summary}`}
      >
        {rows.map((row) => {
          const share = Math.max(0, row.contribution) / total;
          return (
            <div
              key={row.key}
              className="cavatale-compose-seg"
              style={{
                flexGrow: Math.max(share, 0.02),
                background: AXIS_FILL[row.key],
              }}
              title={`${axisLabel(row.key)} · ${Math.round(row.weight * 100)}% · ${formatCavataleRating(row.contribution)}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {rows.map((row) => (
          <span
            key={row.key}
            className="inline-flex items-center gap-1 text-[11px] tabular-nums text-ink-soft"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-[1px]"
              style={{ background: AXIS_FILL[row.key] }}
              aria-hidden
            />
            {axisLabel(row.key)} {Math.round((row.contribution / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
