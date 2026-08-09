"use client";

import { useEffect, useState } from "react";
import { isInDrinkWindow } from "@/lib/drink-window";
import { useT } from "@/lib/i18n";
import type { Wine } from "@/lib/types";

const PREF_KEY = "cavatale.notify.drinkWindow";
const LAST_KEY = "cavatale.notify.drinkWindow.lastAt";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Props = {
  wines: Wine[];
};

/**
 * Opt-in weekly local notification when bottles are in their drink window.
 * Uses Notification API + service worker showNotification (no push server).
 */
export function DrinkWindowNotifyOptIn({ wines }: Props) {
  const t = useT();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const readyCount = wines.filter((w) => isInDrinkWindow(w)).length;

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

  useEffect(() => {
    if (!enabled || perm !== "granted" || readyCount <= 0) return;
    if (typeof window === "undefined") return;

    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_KEY) || "0");
    } catch {
      last = 0;
    }
    if (Date.now() - last < WEEK_MS) return;

    void (async () => {
      const title = t("notify.drinkTitle");
      const body = t("notify.drinkBody", { count: readyCount });
      try {
        const reg = await navigator.serviceWorker?.ready;
        if (reg?.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: "cavatale-drink-window",
            data: { url: "/cava?mode=stats" },
          });
        } else if ("Notification" in window) {
          new Notification(title, { body, icon: "/icons/icon-192.png" });
        }
        localStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {
        // Ignore — notification is best-effort.
      }
    })();
  }, [enabled, perm, readyCount, t]);

  if (perm === "unsupported") return null;

  async function enable() {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result === "granted") {
        localStorage.setItem(PREF_KEY, "1");
        setEnabled(true);
        // Allow an immediate first ping by clearing last stamp.
        localStorage.removeItem(LAST_KEY);
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
      {readyCount > 0 ? (
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
