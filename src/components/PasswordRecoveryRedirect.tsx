"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const PASSWORD_RECOVERY_FLAG = "micava.password_recovery";

/**
 * Recovery emails should hit /auth/reset or /nueva-contrasena.
 * Fallback: Site URL (/, /login) with ?code= or hash tokens → force reset route.
 */
export function PasswordRecoveryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (typeof window === "undefined") return;

    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );
    const code = params.get("code");
    const type = params.get("type") || hashParams.get("type");
    const expectingRecovery =
      sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === "1" ||
      type === "recovery";

    const onResetFlow =
      pathname === "/nueva-contrasena" || pathname.startsWith("/auth/");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
        if (pathname !== "/nueva-contrasena") {
          router.replace("/nueva-contrasena");
        }
      }
    });

    // Any recovery signal + code → dedicated server exchange (cookies on redirect)
    if (code && !onResetFlow && expectingRecovery) {
      const q = new URLSearchParams({ code });
      if (type) q.set("type", type);
      window.location.replace(`/auth/reset?${q.toString()}`);
      return () => subscription.unsubscribe();
    }

    // Bare ?code= on home/login: send through /auth/reset when flagged as recovery
    // after PASSWORD_RECOVERY, or exchange and detect.
    if (
      code &&
      !onResetFlow &&
      (pathname === "/" || pathname === "/login")
    ) {
      let cancelled = false;
      void (async () => {
        let isRecovery = type === "recovery" || expectingRecovery;
        const nested = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") isRecovery = true;
        });

        // Prefer server exchange so cookies stick — only if we already know recovery
        if (isRecovery) {
          nested.data.subscription.unsubscribe();
          const q = new URLSearchParams({ code });
          if (type) q.set("type", type);
          window.location.replace(`/auth/reset?${q.toString()}`);
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState({}, "", pathname);

        await new Promise((r) => setTimeout(r, 800));
        nested.data.subscription.unsubscribe();

        if (cancelled) return;
        if (isRecovery) {
          sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
          router.replace("/nueva-contrasena");
          return;
        }
        if (!error) {
          router.refresh();
        }
      })();

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    }

    // Hash-style recovery tokens (implicit / older templates)
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (
      !onResetFlow &&
      (type === "recovery" || expectingRecovery) &&
      accessToken &&
      refreshToken
    ) {
      void (async () => {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
        window.history.replaceState({}, "", pathname);
        if (!error) router.replace("/nueva-contrasena");
      })();
    }

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
