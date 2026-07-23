"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const PASSWORD_RECOVERY_FLAG = "micava.password_recovery";

/**
 * Recovery emails often land on the Site URL (home) with ?code=...
 * instead of /auth/reset. Exchange that code and, if it's a recovery
 * session, send the user to set a new password.
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

    // Explicit recovery → dedicated server route
    if (code && !onResetFlow && expectingRecovery) {
      const q = new URLSearchParams({ code });
      if (type) q.set("type", type);
      window.location.replace(`/auth/reset?${q.toString()}`);
      return () => subscription.unsubscribe();
    }

    // Bare ?code= on home (Site URL fallback): exchange and detect recovery
    if (code && pathname === "/" && !expectingRecovery) {
      let cancelled = false;
      void (async () => {
        let isRecovery = type === "recovery";
        const nested = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") isRecovery = true;
        });

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        // Drop the used code from the URL
        window.history.replaceState({}, "", "/");

        // Allow PASSWORD_RECOVERY to fire
        await new Promise((r) => setTimeout(r, 600));
        nested.data.subscription.unsubscribe();

        if (cancelled) return;
        if (isRecovery) {
          sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
          router.replace("/nueva-contrasena");
          return;
        }
        if (error) {
          // Code may already be consumed; still try recovery page if flagged later
          return;
        }
        // Email confirm / magic link → stay home (now signed in)
        router.refresh();
      })();

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    }

    // Hash-style recovery tokens (older templates)
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (
      !onResetFlow &&
      expectingRecovery &&
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
