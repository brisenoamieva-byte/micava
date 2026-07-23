"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

/**
 * Soft prompt: Android/Chrome install, or iOS “Add to Home Screen” tip.
 */
export function InstallAppHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [showIosTip, setShowIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    // Desktop: don't inject a banner (causes a vertical jump on load).
    const desktop =
      window.matchMedia("(pointer: fine)").matches &&
      window.matchMedia("(hover: hover)").matches;
    if (desktop) return;

    const key = "micava.install.dismissed";
    if (localStorage.getItem(key) === "1") return;
    setDismissed(false);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if (isIos()) setShowIosTip(true);

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    localStorage.setItem("micava.install.dismissed", "1");
    setDismissed(true);
    setDeferred(null);
    setShowIosTip(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (dismissed) return null;
  if (!deferred && !showIosTip) return null;

  return (
    <div className="mt-4 rounded-[12px] border border-[rgba(110,31,44,0.22)] bg-[rgba(110,31,44,0.06)] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Llevar Cavatale al inicio</p>
          {deferred ? (
            <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">
              Instálala como app: acceso directo, pantalla completa.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">
              En iPhone: toca <strong>Compartir</strong> →{" "}
              <strong>Agregar a inicio</strong>.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {deferred ? (
            <button
              type="button"
              className="btn btn-primary min-h-[36px] px-3 text-sm"
              onClick={() => void install()}
            >
              Instalar
            </button>
          ) : null}
          <button
            type="button"
            className="min-h-[36px] px-2 text-sm text-ink-soft hover:text-ink"
            onClick={dismiss}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
