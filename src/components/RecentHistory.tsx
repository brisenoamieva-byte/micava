"use client";

import { useEffect, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import { resolveLabelImageUrl } from "@/lib/label-image";
import type { CellarLogEntry } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";

type Props = {
  entries: CellarLogEntry[];
};

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-MX", {
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

function hasMemory(e: CellarLogEntry): boolean {
  return Boolean(e.note || e.photoUrl || e.myRating != null);
}

function HistoryPhoto({
  path,
  size = "md",
}: {
  path: string | null;
  size?: "md" | "lg";
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void resolveLabelImageUrl(path).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!src) return null;
  const box =
    size === "lg"
      ? "h-28 w-28 sm:h-32 sm:w-32"
      : "h-14 w-14";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`${box} shrink-0 rounded-[10px] border border-[var(--line)] object-cover`}
    />
  );
}

/**
 * Taste journal from opened bottles — what to buy again.
 * Activity without memory stays secondary.
 */
export function RecentHistory({ entries }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [showActivity, setShowActivity] = useState(false);

  const openedWithMemory = entries.filter(
    (e) => e.action === "opened" && hasMemory(e)
  );
  const latest = openedWithMemory[0] ?? null;
  const restMemory = openedWithMemory.slice(1, 7);
  const favorites = entries
    .filter((e) => e.action === "opened" && (e.myRating ?? 0) >= 4)
    .slice(0, 5);
  const activity = entries.filter(
    (e) => !(e.action === "opened" && hasMemory(e))
  );

  return (
    <section id="taste-memory" className="panel-focus p-4 sm:p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--wine)]">
        {t("history.tastingMemory")}
      </p>
      <h2 className="display mt-1 text-2xl text-ink sm:text-3xl">
        {t("history.title")}
      </h2>
      <p className="mt-0.5 text-sm text-ink-soft">{t("history.lead")}</p>

      {latest ? (
        <div className="mt-4 flex gap-3 rounded-[14px] border border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] p-3 sm:gap-4 sm:p-4">
          <HistoryPhoto path={latest.photoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-soft">
              {t("history.lastOpened")}
            </p>
            <p className="mt-1 text-lg font-medium leading-snug text-ink sm:text-xl">
              {latest.wine.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {[
                latest.wine.winery || null,
                latest.wine.vintage != null ? String(latest.wine.vintage) : null,
                formatWhen(latest.at, locale),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {latest.myRating != null ? (
              <p className="mt-2 text-sm text-[var(--wine)]">
                {stars(latest.myRating)}
              </p>
            ) : null}
            {latest.note ? (
              <p className="mt-2 text-base leading-snug text-ink">
                “{latest.note}”
              </p>
            ) : (
              <p className="mt-2 text-xs text-ink-soft">{t("history.noNote")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[12px] border border-dashed border-[var(--line)] px-4 py-6 text-center">
          <p className="text-sm text-ink-soft">{t("history.emptyMemory")}</p>
        </div>
      )}

      {favorites.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {t("history.favorites")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {favorites.map((e) => (
              <li
                key={`fav-${e.id}`}
                className="inline-flex max-w-full items-center gap-2 rounded-[10px] border border-[rgba(110,31,44,0.2)] bg-[rgba(255,252,247,0.75)] px-2.5 py-1.5"
              >
                <HistoryPhoto path={e.photoUrl} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {e.wine.name}
                  </span>
                  <span className="text-xs text-[var(--wine)]">
                    {stars(e.myRating)}
                    {e.note ? ` · “${e.note}”` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {restMemory.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {restMemory.map((e) => (
            <li
              key={`mem-${e.id}`}
              className="flex gap-3 rounded-[12px] border border-[var(--line)] bg-[rgba(255,252,247,0.65)] p-2.5"
            >
              <HistoryPhoto path={e.photoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {e.wine.name}
                </p>
                <p className="text-xs text-ink-soft">
                  {formatWhen(e.at, locale)}
                  {e.myRating != null ? ` · ${stars(e.myRating)}` : ""}
                </p>
                {e.note ? (
                  <p className="mt-1 text-sm leading-snug text-ink">{e.note}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {activity.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            aria-expanded={showActivity}
            onClick={() => setShowActivity((v) => !v)}
          >
            {showActivity
              ? t("history.hideActivity")
              : t("history.showActivity", { count: activity.length })}
          </button>
          {showActivity ? (
            <ol className="mt-2 space-y-1.5">
              {activity.slice(0, 12).map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[auto_1fr] items-start gap-2 px-1 py-1.5"
                >
                  <CountryFlag country={e.wine.country} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{e.wine.name}</p>
                    <p className="truncate text-xs text-ink-soft">
                      {t(`history.action.${e.action}`)} ·{" "}
                      {formatWhen(e.at, locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
