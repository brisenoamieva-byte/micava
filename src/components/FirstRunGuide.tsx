"use client";

type FirstRunGuideProps = {
  /** Full empty-cava welcome, compact reminder, or one-shot next step after first bottle. */
  variant?: "welcome" | "compact" | "story-next";
  onScan: () => void;
  /** Optional: open the form without going through scan chooser. */
  onManual?: () => void;
  onDismiss?: () => void;
  /** Go to Detalle / focus story CTA (story-next). */
  onTellStory?: () => void;
};

const STEPS = [
  {
    n: "1",
    title: "Sumar la botella",
    body: "Foto de la etiqueta (rápido) o escribe el nombre. La app completa ficha, calificación y precio de referencia.",
  },
  {
    n: "2",
    title: "Acomodarla en el mueble",
    body: "El mapa es la rejilla de tu mueble. Toca un hueco libre (+) o déjala “abajo / fuera” hasta acomodarla.",
  },
  {
    n: "3",
    title: "Contar la historia",
    body: "En Detalle → Contar la historia: relato, dato curioso y gancho para la mesa.",
  },
] as const;

/**
 * Plain-language first-run guide — start by adding your own bottles.
 */
export function FirstRunGuide({
  variant = "welcome",
  onScan,
  onManual,
  onDismiss,
  onTellStory,
}: FirstRunGuideProps) {
  if (variant === "story-next") {
    return (
      <section className="discovery-stage mt-5 sm:mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
              Siguiente paso
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink sm:text-[15px]">
              Ya tienes botella. ¿Contamos su historia? Relato corto, dato
              curioso y con qué maridarlo.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {onTellStory ? (
              <button
                type="button"
                className="btn btn-primary min-h-[40px] px-3 text-sm"
                onClick={onTellStory}
              >
                Contar la historia
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                className="text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                onClick={onDismiss}
              >
                Ahora no
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "compact") {
    return (
      <section className="mt-5 rounded-[12px] border border-[var(--line)] bg-[rgba(255,252,247,0.72)] px-4 py-3 sm:mt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
              Guía rápida
            </p>
            <p className="mt-1 text-sm text-ink">
              Foto o a mano · acomodar en el mapa del mueble · contar la
              historia en Detalle.
            </p>
          </div>
          {onDismiss ? (
            <button
              type="button"
              className="shrink-0 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
              onClick={onDismiss}
            >
              Entendido
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="discovery-stage mt-6 sm:mt-8">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--wine)]">
        Bienvenida a tu cava
      </p>
      <h2 className="display mt-2 text-[1.85rem] leading-tight text-ink sm:text-3xl">
        Empieza con tu primera botella
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-soft sm:text-[15px]">
        Cavatale cuida tu cava en la nube y, cuando quieras, deja que el vino
        hable: historia, dato curioso y maridaje para la mesa.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          className="btn btn-primary min-h-[48px] w-full px-4 text-base sm:w-auto"
          onClick={onScan}
        >
          Escanear etiqueta
        </button>
        {onManual ? (
          <button
            type="button"
            className="btn btn-ghost min-h-[48px] w-full border border-[var(--line)] px-4 text-base sm:w-auto"
            onClick={onManual}
          >
            Escribir a mano
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost min-h-[48px] w-full border border-[var(--line)] px-4 text-base sm:w-auto"
            onClick={onScan}
          >
            Agregar botella
          </button>
        )}
      </div>

      <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink-soft">
        Abajo ves el{" "}
        <span className="font-medium text-ink">mueble Principal</span>: la
        rejilla de tu cava. Cada hueco es un lugar; el “+” suma la botella ahí.
        Si aún no la acomodas, puedes dejarla abajo / fuera.
      </p>

      <ol className="mt-6 space-y-4 border-t border-[rgba(110,31,44,0.14)] pt-5">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span
              className="display flex h-8 w-8 shrink-0 items-center justify-center text-lg text-[var(--wine)]"
              aria-hidden
            >
              {step.n}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-ink">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
