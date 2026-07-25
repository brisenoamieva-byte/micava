"use client";

type FirstRunGuideProps = {
  /** Full empty-cava welcome vs compact reminder. */
  variant?: "welcome" | "compact";
  onScan: () => void;
  onDemo: () => void;
  onDismiss?: () => void;
};

const STEPS = [
  {
    n: "1",
    title: "Agregar una botella",
    body: "Toca “+ Agregar”, toma foto de la etiqueta (o escribe el nombre). La app completa datos y busca rating y precio.",
  },
  {
    n: "2",
    title: "Verla en tu mapa",
    body: "En “Mapa” acomodas cada botella en un hueco del mueble — o la dejas “abajo / fuera”.",
  },
  {
    n: "3",
    title: "Contar la historia",
    body: "Abre la botella en “Detalle” y toca Contar historia: relato, dato curioso y maridaje para la mesa.",
  },
] as const;

/**
 * Plain-language first-run guide — for relatives who are not “app people”.
 */
export function FirstRunGuide({
  variant = "welcome",
  onScan,
  onDemo,
  onDismiss,
}: FirstRunGuideProps) {
  if (variant === "compact") {
    return (
      <section className="mt-5 rounded-[12px] border border-[var(--line)] bg-[rgba(255,252,247,0.72)] px-4 py-3 sm:mt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--wine)]">
              Guía rápida
            </p>
            <p className="mt-1 text-sm text-ink">
              Agregar con foto · acomodar en el mapa · contar la historia en
              Detalle.
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
        Tres cosas que puedes hacer
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-soft">
        Cavatale guarda tus botellas en la nube y te cuenta su historia cuando
        las abres. Empieza como te acomode:
      </p>

      <ol className="mt-6 space-y-5">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span
              className="display flex h-9 w-9 shrink-0 items-center justify-center text-xl text-[var(--wine)]"
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

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className="btn btn-primary min-h-[48px] px-4 text-base"
          onClick={onScan}
        >
          Empezar con una foto
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-[48px] px-4 text-base"
          onClick={onDemo}
        >
          Ver 6 botellas de ejemplo
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-soft">
        Si pruebas el ejemplo, luego toca{" "}
        <span className="text-ink">Terminar prueba (vaciar)</span> para empezar
        con tus botellas. Solo se borra tu cuenta.
      </p>
    </section>
  );
}
