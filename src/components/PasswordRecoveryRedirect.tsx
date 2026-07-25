"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PENDING_PASSWORD_COOKIE } from "@/lib/pending-password";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export const PASSWORD_RECOVERY_FLAG = "micava.password_recovery";

function setPendingPasswordCookie() {
  document.cookie = `${PENDING_PASSWORD_COOKIE}=1; Max-Age=3600; path=/; SameSite=Lax`;
}

/**
 * Recovery emails should hit /auth/reset → /nueva-contrasena.
 * Fallback: Site URL with ?code= / hash → force reset route.
 * PASSWORD_RECOVERY always blocks /cava until a new password is saved.
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

    const goSetPassword = () => {
      sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
      setPendingPasswordCookie();
      if (pathname !== "/nueva-contrasena") {
        router.replace("/nueva-contrasena");
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        goSetPassword();
      }
    });

    // Pending cookie already set (from /auth/reset) but user landed elsewhere
    const pending =
      document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${PENDING_PASSWORD_COOKIE}=`))
        ?.split("=")[1] === "1";
    if (pending && pathname !== "/nueva-contrasena" && !pathname.startsWith("/auth/")) {
      router.replace("/nueva-contrasena");
      return () => subscription.unsubscribe();
    }

    if (code && !onResetFlow && expectingRecovery) {
      const q = new URLSearchParams({ code });
      if (type) q.set("type", type);
      window.location.replace(`/auth/reset?${q.toString()}`);
      return () => subscription.unsubscribe();
    }

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
          goSetPassword();
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
        window.history.replaceState({}, "", pathname);
        if (!error) goSetPassword();
      })();
    }

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  return null;
}
