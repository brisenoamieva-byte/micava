"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AiTheaterStatus } from "@/components/AiTheaterStatus";
import type { KimiResearch } from "@/lib/kimi-research";
import { buildWineShareText, shareOrCopyText } from "@/lib/share-wine";
import type { DepartAction, DepartExtras, Wine } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { clientCountryCodeHint } from "@/lib/market-geo";

type Props = {
  open: boolean;
  wine: Wine | null;
  action: DepartAction;
  onClose: () => void;
  onConfirm: (extras: DepartExtras) => void;
  /** Persist discovery so it stays on the wine / history memory. */
  onSaveDiscovery?: (wine: Wine, research: KimiResearch) => void;
};

type DiscoveryBits = {
  story: string | null;
  curiosity: string | null;
  talkHook: string | null;
};

function bitsFromWine(wine: Wine | null): DiscoveryBits {
  return {
    story: wine?.kimiSummary ?? null,
    curiosity: wine?.kimiCuriosity ?? null,
    talkHook: wine?.kimiTalkHook ?? null,
  };
}

function hasBits(d: DiscoveryBits): boolean {
  return Boolean(d.story || d.curiosity || d.talkHook);
}

export function DepartTasteModal({
  open,
  wine,
  action,
  onClose,
  onConfirm,
  onSaveDiscovery,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [myRating, setMyRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryBits>({
    story: null,
    curiosity: null,
    talkHook: null,
  });
  const [loadingStory, setLoadingStory] = useState(false);
  const [storyError, setStoryError] = useState("");
  const [shareHint, setShareHint] = useState<string | null>(null);

  const titleKey =
    action === "opened"
      ? "depart.openedTitle"
      : action === "gifted"
        ? "depart.giftedTitle"
        : "depart.removedTitle";
  const submitKey =
    action === "opened"
      ? "depart.openedSubmit"
      : action === "gifted"
        ? "depart.giftedSubmit"
        : "depart.removedSubmit";
  const leadKey =
    action === "opened"
      ? "depart.openedLead"
      : action === "gifted"
        ? "depart.giftedLead"
        : "depart.removedLead";

  useEffect(() => {
    if (!open || !wine) return;
    setMyRating(null);
    setNote("");
    setStoryError("");
    setShareHint(null);
    const existing = bitsFromWine(wine);
    setDiscovery(existing);

    if (hasBits(existing) || action === "removed") {
      setLoadingStory(false);
      return;
    }

    let cancelled = false;
    setLoadingStory(true);
    const wineSnapshot = wine;
    void (async () => {
      try {
        const countryCode = clientCountryCodeHint();
        const res = await fetch("/api/research-wine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: wineSnapshot.name,
            winery: wineSnapshot.winery,
            country: wineSnapshot.country,
            region: wineSnapshot.region,
            type: wineSnapshot.type,
            grape: wineSnapshot.grape,
            aging: wineSnapshot.aging,
            vintage: wineSnapshot.vintage,
            vivino: wineSnapshot.vivino,
            cavataleRating: wineSnapshot.cavataleRating,
            price: wineSnapshot.price,
            locale,
            ...(countryCode ? { countryCode } : {}),
          }),
        });
        const raw = await res.text();
        let payload: { error?: string; research?: KimiResearch } = {};
        try {
          payload = JSON.parse(raw) as {
            error?: string;
            research?: KimiResearch;
          };
        } catch {
          throw new Error(
            res.ok
              ? t("scan.unexpectedFormat")
              : t("errors.generic")
          );
        }
        if (!res.ok || !payload.research) {
          throw new Error(payload.error || t("scan.couldNotTellStory"));
        }
        if (cancelled) return;
        const research = payload.research;
        setDiscovery({
          story: research.kimiSummary,
          curiosity: research.kimiCuriosity,
          talkHook: research.kimiTalkHook,
        });
        onSaveDiscovery?.(wineSnapshot, research);
      } catch (e) {
        if (!cancelled) {
          setStoryError(
            e instanceof Error ? e.message : t("scan.couldNotTellStory")
          );
        }
      } finally {
        if (!cancelled) setLoadingStory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentional: only re-run when the modal opens for a wine/action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wine?.id, action]);

  if (!open || !wine) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm({
      myRating,
      note: note.trim() || null,
    });
  }

  async function handleShareStory() {
    if (!wine) return;
    const text = buildWineShareText(wine, {
      story: discovery.story,
      curiosity: discovery.curiosity,
      talkHook: discovery.talkHook,
    });
    const result = await shareOrCopyText(text, wine.name);
    if (result === "copied") {
      setShareHint(t("depart.copiedWhatsapp"));
      window.setTimeout(() => setShareHint(null), 2500);
    }
  }

  const showDiscovery = action === "opened" || action === "gifted";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,18,16,0.45)] p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="depart-taste-title"
      onClick={onClose}
    >
      <form
        className="panel max-h-[92dvh] w-full max-w-md overflow-y-auto p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          {wine.name}
          {wine.winery ? ` · ${wine.winery}` : ""}
          {wine.vintage ? ` · ${wine.vintage}` : ""}
        </p>
        <h2 id="depart-taste-title" className="display mt-1 text-3xl text-ink">
          {t(titleKey)}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t(leadKey)}</p>

        {showDiscovery ? (
          <div className="mt-5 space-y-3 border-t border-[var(--line)] pt-4">
            <AiTheaterStatus active={loadingStory} />
            {storyError ? (
              <p className="text-sm text-[var(--wine)]">{storyError}</p>
            ) : null}
            {!loadingStory && hasBits(discovery) ? (
              <>
                {discovery.talkHook ? (
                  <div className="tale-hook">
                    <p className="tale-hook-label text-[11px] uppercase tracking-[0.16em]">
                      {action === "opened"
                        ? t("wine.talkHook")
                        : t("depart.tellThem")}
                    </p>
                    <p className="display mt-2 text-[1.25rem] leading-snug">
                      {discovery.talkHook}
                    </p>
                  </div>
                ) : null}
                {discovery.story ? (
                  <div className="reveal-in-delay">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                      {t("wine.story")}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink">
                      {discovery.story}
                    </p>
                  </div>
                ) : null}
                {discovery.curiosity ? (
                  <div className="reveal-in-delay">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                      {t("wine.curiosity")}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink">
                      {discovery.curiosity}
                    </p>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary min-h-[48px] w-full text-base"
                  onClick={() => void handleShareStory()}
                >
                  {shareHint ?? t("depart.shareWhatsapp")}
                </button>
              </>
            ) : null}
            {!loadingStory && !hasBits(discovery) && !storyError ? (
              <p className="text-sm text-ink-soft">{t("depart.noStoryYet")}</p>
            ) : null}
          </div>
        ) : null}

        {action !== "removed" ? (
          <>
            <fieldset className="mt-5">
              <legend className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {action === "opened"
                  ? t("depart.yourRating")
                  : t("depart.ratingOptional")}
              </legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = myRating === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMyRating(n)}
                      className={[
                        "min-h-[44px] min-w-[44px] rounded-[10px] border text-sm font-medium transition",
                        active
                          ? "border-[var(--wine)] bg-[rgba(110,31,44,0.12)] text-ink"
                          : "border-[var(--line)] bg-[rgba(255,252,247,0.7)] text-ink-soft hover:border-[rgba(110,31,44,0.3)]",
                      ].join(" ")}
                      aria-pressed={active}
                      aria-label={t("depart.ratingAria", { n })}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">
                {action === "opened"
                  ? t("depart.ratingScale")
                  : t("depart.ratingMemory")}
              </p>
            </fieldset>

            <label className="mt-4 block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {t("depart.shortNote")}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 180))}
                rows={2}
                placeholder={
                  action === "opened"
                    ? t("depart.openedNotePlaceholder")
                    : t("depart.giftedNotePlaceholder")
                }
                className="w-full rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.95)] px-3 py-2.5 text-sm outline-none focus:border-[rgba(122,36,48,0.45)]"
              />
              <span className="mt-1 block text-right text-[10px] text-ink-soft">
                {note.length}/180
              </span>
            </label>
          </>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-ghost min-h-[44px]"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary min-h-[44px]">
            {t(submitKey)}
          </button>
        </div>
      </form>
    </div>
  );
}
