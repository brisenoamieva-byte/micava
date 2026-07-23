"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-store";
import { useCellar } from "@/lib/cellar-store";
import { cellarStats, formatPrice } from "@/lib/wines";

export default function HomePage() {
  const { user, ready } = useAuth();
  const { wines } = useCellar();
  const stats = cellarStats(wines);
  const loggedIn = Boolean(user);

  return (
    <main className="grain relative min-h-screen min-h-[100dvh] overflow-hidden">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:px-6 md:px-10">
        <header className="fade-up flex items-center justify-between gap-4">
          <p className="display text-2xl tracking-tight text-[#141210] md:text-3xl">
            Mi Cava
          </p>
          <div className="flex items-center gap-2">
            {ready && loggedIn ? (
              <Link href="/cava" className="btn btn-ghost min-h-[44px] px-4 text-sm">
                Mi cava
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost min-h-[44px] px-4 text-sm">
                  Entrar
                </Link>
                <Link
                  href="/registro"
                  className="btn btn-primary min-h-[44px] px-4 text-sm"
                >
                  Crear cava
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="relative flex flex-1 flex-col justify-center py-12 sm:py-16 md:py-20">
          <div className="pointer-events-none absolute inset-y-0 right-[-10%] hidden w-[58%] md:block">
            <div className="hero-silhouette h-full w-full" />
          </div>

          <div className="relative max-w-xl">
            <h1 className="display fade-up text-[clamp(3rem,14vw,7rem)] leading-[0.9] text-[#141210]">
              Mi Cava
            </h1>
            <p className="fade-up-delay mt-5 max-w-md text-base leading-relaxed text-[#4f4a43] sm:mt-6 sm:text-lg md:text-xl">
              Tu inventario, mapa y criterio — en la nube, solo tuyos. Gratis
              para quienes cuidan su cava.
            </p>

            <div className="fade-up-delay-2 mt-8 flex flex-col items-start gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                href={loggedIn ? "/cava" : "/registro"}
                className="btn btn-primary min-h-[48px] w-full text-base sm:w-auto"
              >
                {loggedIn ? "Abrir mi cava" : "Crear mi cava"}
              </Link>
              {!loggedIn ? (
                <Link
                  href="/login"
                  className="text-sm text-[#4f4a43] underline-offset-2 hover:underline"
                >
                  Ya tengo cuenta
                </Link>
              ) : (
                <p className="text-sm text-[#4f4a43]">
                  {stats.bottles} botellas · {formatPrice(stats.value)}
                </p>
              )}
            </div>

            <p className="fade-up-delay-2 mt-8 max-w-sm text-sm leading-relaxed text-[#4f4a43]">
              Sin suscripciones. Si un día te gusta, regálame una botella —
              trato entre amigos del vino.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
