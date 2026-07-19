"use client";

import Link from "next/link";
import { useCellar } from "@/lib/cellar-store";
import { cellarStats, formatPrice } from "@/lib/wines";

export default function HomePage() {
  const { wines } = useCellar();
  const stats = cellarStats(wines);

  return (
    <main className="grain relative min-h-screen min-h-[100dvh] overflow-hidden">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] sm:px-6 md:px-10">
        <header className="fade-up flex items-center justify-between gap-4">
          <p className="display text-2xl tracking-tight text-[#141210] md:text-3xl">Mi Cava</p>
          <Link href="/cava" className="btn btn-ghost min-h-[44px] px-4 text-sm">
            Entrar
          </Link>
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
              Sabes qué tienes, dónde está y qué conviene abrir — o regalar —
              sin abrir una hoja de cálculo.
            </p>

            <div className="fade-up-delay-2 mt-8 flex flex-col items-start gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <Link href="/cava" className="btn btn-primary min-h-[48px] w-full text-base sm:w-auto">
                Abrir mi cava
              </Link>
              <p className="text-sm text-[#4f4a43]">
                {stats.bottles} botellas · {formatPrice(stats.value)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
