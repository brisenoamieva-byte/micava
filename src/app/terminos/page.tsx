import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Condiciones del servicio — Cavatale",
  description:
    "Términos y condiciones de uso de la aplicación Cavatale.",
};

export default function TerminosPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto max-w-2xl px-5 pb-16 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6">
        <BrandMark size="sm" />

        <article className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
          <header>
            <h1 className="display text-4xl text-ink sm:text-5xl">
              Condiciones del servicio
            </h1>
            <p className="mt-2 text-ink-soft">
              Última actualización: 25 de julio de 2026
            </p>
            <p className="mt-4 text-ink-soft">
              Estas condiciones regulan el uso de{" "}
              <strong className="text-ink">Cavatale</strong> (
              <a
                href="https://cavatale.com"
                className="text-ink underline-offset-2 hover:underline"
              >
                cavatale.com
              </a>
              ) y sus funciones relacionadas. Al crear una cuenta o usar la
              aplicación, aceptas estas condiciones y nuestra{" "}
              <Link
                href="/privacidad"
                className="text-ink underline-offset-2 hover:underline"
              >
                Política de privacidad
              </Link>
              .
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">1. El servicio</h2>
            <p className="text-ink-soft">
              Cavatale es una aplicación para gestionar una cava personal de
              vinos: inventario, mapa de muebles, historias y valoraciones
              asistidas por IA, y —si lo activas— una red opt-in para conocer a
              otros usuarios y chatear en privado. El producto puede estar en
              beta y cambiar con el tiempo.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">2. Elegibilidad</h2>
            <p className="text-ink-soft">
              Debes tener la edad legal para consumir alcohol en tu
              jurisdicción y capacidad para aceptar estos términos. No uses
              Cavatale si las leyes locales te lo prohíben.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">3. Tu cuenta</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
              <li>
                Eres responsable de la confidencialidad de tu acceso (email/
                contraseña o inicio con Google) y de la actividad en tu cuenta.
              </li>
              <li>
                Debes proporcionar información veraz en lo esencial (p. ej.
                email válido) y mantenerla actualizada.
              </li>
              <li>
                Podemos suspender o cerrar cuentas que abusen del servicio,
                vulneren estas condiciones o pongan en riesgo a otros usuarios.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              4. Contenido que publicas
            </h2>
            <p className="text-ink-soft">
              Conservas los derechos sobre el contenido que subes (fotos de
              etiquetas, notas, mensajes, perfil de red). Nos concedes una
              licencia limitada para alojarlo, mostrártelo y operar el servicio
              (incluida la generación de historias/ratings con IA a partir de
              los datos de botella que indiques).
            </p>
            <p className="text-ink-soft">
              No subas contenido ilegal, ofensivo, que infrinja derechos de
              terceros, ni uses la red o el chat para acoso, spam o fraude.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              5. Red de usuarios y chat
            </h2>
            <p className="text-ink-soft">
              Aparecer en el directorio es voluntario (“Aparecer en la red”).
              Los chats son entre usuarios adultos. Cavatale no garantiza la
              conducta de terceros; reporta abusos a{" "}
              <a
                href="mailto:hello@lumien.org"
                className="text-ink underline-offset-2 hover:underline"
              >
                hello@lumien.org
              </a>
              . Tu inventario privado de cava no se publica en la red.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              6. Contenido generado por IA
            </h2>
            <p className="text-ink-soft">
              Las historias, curiosidades, maridajes, precios estimados, scores
              Vivino estimados y la calificación Cavatale pueden generarse con
              modelos de inteligencia artificial. Son orientativos: pueden
              contener errores o imprecisiones. No sustituyen fichas oficiales
              de bodega, crítica profesional ni asesoramiento legal, médico o
              comercial. Úsalos como ayuda para conversar y organizar tu cava.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              7. Propiedad de Cavatale
            </h2>
            <p className="text-ink-soft">
              La marca Cavatale, el diseño de la app, el software y los
              materiales propios son de sus titulares. No puedes copiar,
              revender ni explotar el servicio sin autorización, salvo el uso
              personal permitido por estas condiciones.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              8. Disponibilidad y cambios
            </h2>
            <p className="text-ink-soft">
              Nos esforzamos por mantener Cavatale disponible, pero no
              garantizamos un servicio ininterrumpido ni libre de errores.
              Podemos modificar, limitar o discontinuar funciones (incluida la
              beta) con o sin aviso previo razonable según el caso.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">9. Gratuitad</h2>
            <p className="text-ink-soft">
              Hoy el servicio se ofrece de forma gratuita en beta. En el futuro
              podrían existir planes de pago o límites; si eso ocurre, se
              comunicará de forma clara antes de cobrar.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              10. Exención de responsabilidad
            </h2>
            <p className="text-ink-soft">
              En la medida permitida por la ley, Cavatale se ofrece “tal cual”.
              No respondemos por daños indirectos, lucros cesantes, pérdida de
              datos (más allá de lo que podamos restaurar de buena fe) ni por
              decisiones de compra o consumo tomadas a partir de estimaciones
              o textos de la app. Nada en estas condiciones limita derechos
              imperativos del consumidor que no puedan renunciarse.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">11. Terminación</h2>
            <p className="text-ink-soft">
              Puedes dejar de usar Cavatale en cualquier momento y solicitar la
              eliminación de tu cuenta escribiendo a{" "}
              <a
                href="mailto:hello@lumien.org"
                className="text-ink underline-offset-2 hover:underline"
              >
                hello@lumien.org
              </a>
              . Podemos terminar o restringir el acceso si incumples estas
              condiciones.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              12. Ley aplicable
            </h2>
            <p className="text-ink-soft">
              Salvo norma imperativa en contrario, estas condiciones se
              interpretan conforme a las leyes de los Estados Unidos Mexicanos,
              sin perjuicio de derechos irrenunciables que te correspondan en
              tu lugar de residencia.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">13. Contacto</h2>
            <p className="text-ink-soft">
              Dudas sobre el servicio o estas condiciones:{" "}
              <a
                href="mailto:hello@lumien.org"
                className="text-ink underline-offset-2 hover:underline"
              >
                hello@lumien.org
              </a>
            </p>
          </section>
        </article>

        <p className="mt-12 flex flex-wrap gap-4 text-sm text-ink-soft">
          <Link href="/" className="underline-offset-2 hover:underline">
            ← Volver al inicio
          </Link>
          <Link
            href="/privacidad"
            className="underline-offset-2 hover:underline"
          >
            Política de privacidad
          </Link>
        </p>
      </div>
    </main>
  );
}
