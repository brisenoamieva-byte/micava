"use client";

import { useEffect } from "react";

/** Registers the service worker so the site can be installed as an app. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Dev + HMR: a SW on localhost fights Turbopack and makes the page flicker.
    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      return;
    }

    if (!window.isSecureContext) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore — install may still work via Add to Home Screen on iOS
    });
  }, []);

  return null;
}
