"use client";

import { useEffect, useMemo, useState } from "react";
import { wineIdentityKey } from "@/lib/analytics";
import { drinkStatus, isInDrinkWindow } from "@/lib/drink-window";
import { useT } from "@/lib/i18n";
import type { Wine } from "@/lib/types";

const PREF_KEY = "cavatale.notify.drinkWindow";
const LAST_DIGEST_KEY = "cavatale.notify.drinkWindow.lastAt";
const PEAK_IDS_KEY = "cavatale.notify.peakIds";
const LAST_PEAK_KEY = "cavatale.notify.peak.lastAt";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PEAK_COOLDOWN_MS = 18 * 60 * 60 * 1000;
const FOCUS_URL = "/cava?mode=stats&focus=open-tonight";

type Props = {
  wines: Wine[];
};

async function showLocalNotification(title: string, body: string) {
  const reg = await navigator.serviceWorker?.ready;
  if (reg?.showNotification) {
    await reg.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "cavatale-drink-window",
      data: { url: FOCUS_URL },
    });
    return;
  }
  if ("Notification" in window) {
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  }
}

function readPeakIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PEAK_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writePeakIds(ids: Set<string>) {
  try {
    localStorage.setItem(PEAK_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

/**
 * Opt-in local notifications:
 * - Immediate-ish ping when a bottle newly enters peak
 * - Weekly digest while bottles sit in the drink window
 */
export function DrinkWindowNotifyOptIn({ wines }: Props) {
  const t = useT();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const readyCount = useMemo(
    () => wines.filter((w) => isInDrinkWindow(w)).length,
    [wines]
  );
  const peakWines = useMemo(
    () => wines.filter((w) => drinkStatus(w) === "peak"),
    [wines]
  );
  const peakCount = peakWines.length;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
    try {
      setEnabled(localStorage.getItem(PREF_KEY) === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  // Peak-entry alerts: fire when new peak identities appear.
  useEffect(() => {
    if (!enabled || perm !== "granted") return;
    if (typeof window === "undefined") return;

    const currentIds = new Set(
      peakWines.map((w) => wineIdentityKey(w))
    );
    const previous = readPeakIds();

    // First run after enable: seed without spamming every current peak.
    if (previous.size === 0 && currentIds.size > 0) {
      writePeakIds(currentIds);
      return;
    }

    const newcomers = peakWines.filter(
      (w) => !previous.has(wineIdentityKey(w))
    );
    writePeakIds(currentIds);
    if (newcomers.length === 0) return;

    let lastPeak = 0;
    try {
      lastPeak = Number(localStorage.getItem(LAST_PEAK_KEY) || "0");
    } catch {
      lastPeak = 0;
    }
    if (Date.now() - lastPeak < PEAK_COOLDOWN_MS) return;

    const names = newcomers
      .slice(0, 2)
      .map((w) => w.name)
      .filter(Boolean);
    const title = t("notify.peakTitle");
    const body =
      newcomers.length === 1 && names[0]
        ? t("notify.peakBodyOne", { name: names[0] })
        : t("notify.peakBodyMany", {
            count: newcomers.length,
            names: names.join(", "),
          });

    void (async () => {
      try {
        await showLocalNotification(title, body);
        localStorage.setItem(LAST_PEAK_KEY, String(Date.now()));
      } catch {
        /* best-effort */
      }
    })();
  }, [enabled, perm, peakWines, t]);

  // Weekly digest while anything is in window.
  useEffect(() => {
    if (!enabled || perm !== "granted" || readyCount <= 0) return;
    if (typeof window === "undefined") return;

    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_DIGEST_KEY) || "0");
    } catch {
      last = 0;
    }
    if (Date.now() - last < WEEK_MS) return;

    const title = t("notify.drinkTitle");
    const body =
      peakCount > 0
        ? t("notify.drinkBodyPeak", {
            peak: peakCount,
            count: readyCount,
          })
        : t("notify.drinkBody", { count: readyCount });

    void (async () => {
      try {
        await showLocalNotification(title, body);
        localStorage.setItem(LAST_DIGEST_KEY, String(Date.now()));
      } catch {
        /* best-effort */
      }
    })();
  }, [enabled, perm, readyCount, peakCount, t]);

  if (perm === "unsupported") return null;

  async function enable() {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result === "granted") {
        localStorage.setItem(PREF_KEY, "1");
        setEnabled(true);
        // Seed peaks so enabling doesn't dump every current peak as "new".
        writePeakIds(
          new Set(
            wines
              .filter((w) => drinkStatus(w) === "peak")
              .map((w) => wineIdentityKey(w))
          )
        );
        localStorage.removeItem(LAST_DIGEST_KEY);
        localStorage.removeItem(LAST_PEAK_KEY);
      }
    } finally {
      setBusy(false);
    }
  }

  function disable() {
    localStorage.removeItem(PREF_KEY);
    setEnabled(false);
  }

  return (
    <section className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.65)] px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        {t("notify.label")}
      </p>
      <p className="mt-1 text-sm text-ink">{t("notify.lead")}</p>
      {peakCount > 0 ? (
        <p className="mt-1 text-xs text-ink-soft">
          {t("notify.peakNow", { count: peakCount })}
        </p>
      ) : readyCount > 0 ? (
        <p className="mt-1 text-xs text-ink-soft">
          {t("notify.readyNow", { count: readyCount })}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {enabled && perm === "granted" ? (
          <button
            type="button"
            className="btn btn-ghost min-h-[40px] border border-[var(--line)] px-3 text-sm"
            onClick={disable}
          >
            {t("notify.disable")}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary min-h-[40px] px-3 text-sm"
            disabled={busy || perm === "denied"}
            onClick={() => void enable()}
          >
            {perm === "denied" ? t("notify.denied") : t("notify.enable")}
          </button>
        )}
      </div>
    </section>
  );
}
