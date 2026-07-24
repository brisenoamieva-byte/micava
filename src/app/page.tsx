"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { BrandWordmark } from "@/components/BrandWordmark";
import { useAuth } from "@/lib/auth-store";
import { useCellar } from "@/lib/cellar-store";
import { cellarStats, formatPrice } from "@/lib/wines";

const STEPS = [
  {
    n: "01",
    title: "Escanea la etiqueta",
    body: "Una foto basta. La IA completa nombre, uva, región y más.",
  },
  {
    n: "02",
    title: "Acomoda en tu mueble",
    body: "Mapa de la cava: cada botella en su hueco, o abajo / fuera.",
  },
  {
    n: "03",
    title: "Cuenta la historia",
    body: "Al descorchar: relato, dato curioso, maridaje y un gancho para la mesa.",
  },
] as const;

export default function HomePage() {
  const { user, ready } = useAuth();
  const { wines } = useCellar();
  const stats = cellarStats(wines);
  const loggedIn = Boolean(user);

  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6 md:px-10">
        <header className="fade-up flex items-center justify-between gap-4">
          <BrandMark size="md" />
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
            <h1 className="fade-up leading-none text-[#141210]">
              <BrandWordmark size="hero" />
            </h1>
            <p className="fade-up-delay mt-5 max-w-md text-base leading-relaxed text-[#4f4a43] sm:mt-6 sm:text-lg md:text-xl">
              Tu cava en la nube — con historias que abren conversación al
              descorchar. Gratis para quienes cuidan sus botellas.
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

      <section
        id="como"
        className="relative z-10 border-t border-[var(--line)] bg-[rgba(250,249,245,0.45)]"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 md:px-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            Cómo funciona
          </p>
          <h2 className="display mt-2 max-w-lg text-3xl text-ink sm:text-4xl">
            Tres gestos. Sin complicarte.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft sm:text-base">
            Instálala en el teléfono como app. Escanea en la tienda o en casa;
            las historias llegan cuando las necesitas en la mesa.
          </p>

          <ol className="mt-12 grid gap-10 sm:mt-14 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step) => (
              <li key={step.n} className="min-w-0">
                <p className="display text-4xl leading-none text-[var(--wine)] sm:text-5xl">
                  {step.n}
                </p>
                <h3 className="mt-4 text-lg font-medium text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-14 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Link
              href={loggedIn ? "/cava" : "/registro"}
              className="btn btn-primary min-h-[48px] w-full text-base sm:w-auto"
            >
              {loggedIn ? "Abrir mi cava" : "Empezar gratis"}
            </Link>
            <p className="text-sm text-ink-soft">
              Beta abierta — hecha para coleccionistas.
            </p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[var(--line)] px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
          <BrandWordmark size="sm" />
          <p>cavatale.com</p>
        </div>
      </footer>
    </main>
  );
}
