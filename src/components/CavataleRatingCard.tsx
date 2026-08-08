"use client";

import {
  buildCavataleAxisBreakdown,
  CAVATALE_EVIDENCE_KEYS,
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

/**
 * Official Cavatale score + optional axis/evidence breakdown for auditability.
 */
export function CavataleRatingCard({
  rating,
  parts,
  evidence,
  rubric,
}: Props) {
  const t = useT();
  const rows = parts ? buildCavataleAxisBreakdown(parts) : null;

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

      {rows ? (
        <div className="mt-3 space-y-2 border-t border-[rgba(110,31,44,0.16)] pt-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {t("wine.cavataleBreakdown.title")}
          </p>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.key} className="text-sm text-ink">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {t(`wine.cavataleBreakdown.axes.${row.key}`)}
                    <span className="ml-1 font-normal text-ink-soft">
                      ({Math.round(row.weight * 100)}%)
                    </span>
                  </span>
                  <span className="tabular-nums text-ink">
                    {formatCavataleRating(row.score)}
                    <span className="text-ink-soft">
                      {" "}
                      → {formatCavataleRating(row.contribution)}
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-ink-soft">
                  {t(`wine.cavataleBreakdown.axisHints.${row.key}`)}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft">
            {t("wine.cavataleBreakdown.formulaNote")}
          </p>
        </div>
      ) : null}

      {evidence ? (
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
