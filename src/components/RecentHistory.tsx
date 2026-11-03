"use client";

import { useEffect, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import { resolveLabelImageUrl } from "@/lib/label-image";
import type { CellarLogEntry } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { formatPrice } from "@/lib/wines";

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

function HistoryPhoto({ path }: { path: string | null }) {
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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-14 w-14 shrink-0 rounded-[8px] border border-[var(--line)] object-cover"
    />
  );
}

export function RecentHistory({ entries }: Props) {
  const t = useT();
  const { locale } = useLocale();
  if (entries.length === 0) return null;

  const favorites = entries
    .filter((e) => e.action === "opened" && (e.myRating ?? 0) >= 4)
    .slice(0, 5);

  const openedWithMemory = entries.filter(
    (e) => e.action === "opened" && (e.note || e.photoUrl || e.myRating != null)
  );

  return (
    <section className="panel-quiet p-4 sm:p-5">
      <h2 className="display text-2xl text-ink">{t("history.title")}</h2>
      <p className="mt-0.5 text-sm text-ink-soft">{t("history.lead")}</p>

      {favorites.length > 0 ? (
        <div className="mt-4 rounded-[10px] border border-[rgba(110,31,44,0.2)] bg-[rgba(110,31,44,0.05)] p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {t("history.favorites")}
          </p>
          <ul className="mt-2 space-y-2">
            {favorites.map((e) => (
              <li
                key={`fav-${e.id}`}
                className="flex items-start gap-2.5 text-sm text-ink"
              >
                <HistoryPhoto path={e.photoUrl} />
                <span className="min-w-0">
                  <span className="font-medium">{e.wine.name}</span>
                  <span className="ml-2 text-xs text-[var(--wine)]">
                    {stars(e.myRating)}
                  </span>
                  {e.note ? (
                    <span className="mt-0.5 block text-sm leading-snug text-ink">
                      “{e.note}”
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {openedWithMemory.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {t("history.tastingMemory")}
          </p>
          <ul className="mt-2 space-y-2.5">
            {openedWithMemory.slice(0, 6).map((e) => (
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
                    <p className="mt-1.5 text-sm leading-snug text-ink">
                      {e.note}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-soft">
                      {t("history.noNote")}
                    </p>
                  )}
                </div>
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
                {t(`history.action.${e.action}`)} · {formatWhen(e.at, locale)}
                {e.myRating != null ? ` · ${stars(e.myRating)}` : ""}
              </p>
              {e.note ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-ink">{e.note}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right text-xs text-ink">
              <span className="block text-ink-soft">
                {formatPrice(e.wine.price)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
