"use client";

import { useEffect } from "react";

/** Registers the service worker so the site can be installed as an app. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    // Allow install on localhost + production HTTPS
    if (!window.isSecureContext && !isLocal) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore — install may still work via Add to Home Screen on iOS
    });
  }, []);

  return null;
}
