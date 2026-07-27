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
    title: "Foto de la etiqueta",
    body: "Como sacar una foto con el celular. La app reconoce el vino y completa la ficha.",
  },
  {
    n: "02",
    title: "Tu mapa de la cava",
    body: "Cada botella en su hueco del mueble — o “abajo” si aún no la acomodas.",
  },
  {
    n: "03",
    title: "La historia al abrir",
    body: "Un relato corto, un dato curioso y con qué maridarlo — para contarlo en la mesa.",
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
            <div
              className="hero-silhouette h-full w-full"
              aria-hidden
              role="presentation"
            >
              <svg
                className="hero-silhouette-svg"
                viewBox="0 0 360 440"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  className="rack-fill"
                  x="28"
                  y="36"
                  width="304"
                  height="368"
                  rx="14"
                />
                <rect
                  className="rack-edge"
                  x="28"
                  y="36"
                  width="304"
                  height="368"
                  rx="14"
                />
                {/* Vertical cell lines — 5 columns */}
                {[1, 2, 3, 4].map((i) => (
                  <line
                    key={`v${i}`}
                    className="rack-line"
                    x1={28 + i * 60.8}
                    y1="36"
                    x2={28 + i * 60.8}
                    y2="404"
                  />
                ))}
                {/* Horizontal shelves — 4 rows */}
                {[1, 2, 3].map((i) => (
                  <line
                    key={`h${i}`}
                    className="rack-line"
                    x1="28"
                    y1={36 + i * 92}
                    x2="332"
                    y2={36 + i * 92}
                  />
                ))}
                {/* Bottle silhouettes: crisp paths, some empty slots */}
                {(
                  [
                    [0, 0, "#6e1f2c"],
                    [1, 0, "#4f1520"],
                    [2, 0, "#3a4a3d"],
                    [4, 0, "#6e1f2c"],
                    [0, 1, "#7d6344"],
                    [2, 1, "#6e1f2c"],
                    [3, 1, "#4f1520"],
                    [4, 1, "#3a4a3d"],
                    [1, 2, "#6e1f2c"],
                    [2, 2, "#4f1520"],
                    [3, 2, "#7d6344"],
                    [0, 3, "#4f1520"],
                    [1, 3, "#3a4a3d"],
                    [3, 3, "#6e1f2c"],
                    [4, 3, "#7d6344"],
                  ] as const
                ).map(([col, row, fill], i) => {
                  const cx = 28 + col * 60.8 + 30.4;
                  const cy = 36 + row * 92 + 78;
                  return (
                    <g
                      key={i}
                      className="bottle"
                      transform={`translate(${cx} ${cy})`}
                    >
                      {/* cork */}
                      <rect
                        x="-3.2"
                        y="-62"
                        width="6.4"
                        height="7"
                        rx="1.2"
                        fill={fill}
                        opacity="0.85"
                      />
                      {/* neck */}
                      <path
                        d="M-3.4 -55 V-42 C-3.4 -38 -5.5 -35 -8 -32 L-9.5 -18 V8 C-9.5 12 -6.5 14 0 14 C6.5 14 9.5 12 9.5 8 V-18 L8 -32 C5.5 -35 3.4 -38 3.4 -42 V-55 Z"
                        fill={fill}
                      />
                      {/* shoulder highlight */}
                      <path
                        d="M-2.2 -54 V-43 C-2.2 -40 -3.8 -37.5 -5.5 -35.5"
                        stroke="rgba(255,252,247,0.22)"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="relative max-w-xl">
            <h1 className="fade-up leading-none text-[#141210]">
              <BrandWordmark size="hero" />
            </h1>
            <p className="fade-up-delay mt-5 max-w-lg text-base leading-relaxed text-ink-soft sm:mt-6 sm:text-lg md:text-[1.25rem] md:leading-snug">
              Cada botella guarda un lugar, unas manos, una decisión. Cavatale
              deja que el vino hable: cuida tu cava y, al descorchar, te entrega
              la historia que abre la conversación.
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
                  className="text-sm text-ink-soft underline-offset-2 hover:underline"
                >
                  Ya tengo cuenta
                </Link>
              ) : (
                <p className="text-sm text-ink-soft">
                  {stats.bottles} botellas · {formatPrice(stats.value)}
                </p>
              )}
            </div>
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
            Escanea en la tienda o en casa. Acomoda. Cuando abras, la historia
            está lista para la mesa.
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href="/privacidad"
              className="underline-offset-2 hover:text-ink hover:underline"
            >
              Privacidad
            </Link>
            <Link
              href="/terminos"
              className="underline-offset-2 hover:text-ink hover:underline"
            >
              Condiciones
            </Link>
            <p>cavatale.com</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
