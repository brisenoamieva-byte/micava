import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Política de privacidad — Cavatale",
  description:
    "Cómo Cavatale recopila, usa y protege tus datos personales.",
};

export default function PrivacidadPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto max-w-2xl px-5 pb-16 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6">
        <BrandMark size="sm" />

        <article className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
          <header>
            <h1 className="display text-4xl text-ink sm:text-5xl">
              Política de privacidad
            </h1>
            <p className="mt-2 text-ink-soft">
              Última actualización: 25 de julio de 2026
            </p>
            <p className="mt-4 text-ink-soft">
              Esta política describe cómo <strong className="text-ink">Cavatale</strong>{" "}
              (<span className="text-ink-soft">(cavatale.com)</span> trata la
              información de quienes usan la aplicación. Al crear una cuenta o
              usar el servicio, aceptas estas prácticas.
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">1. Responsable</h2>
            <p className="text-ink-soft">
              El responsable del tratamiento es el operador de Cavatale. Para
              ejercer derechos o hacer consultas de privacidad:{" "}
              <a
                href="mailto:hello@lumien.org"
                className="text-ink underline-offset-2 hover:underline"
              >
                hello@lumien.org
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              2. Datos que recopilamos
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
              <li>
                <strong className="text-ink">Cuenta:</strong> correo
                electrónico, nombre para mostrar y, si inicias con Google, los
                datos básicos que Google nos comparte (nombre, email e
                identificador de cuenta) según los permisos que autorices.
              </li>
              <li>
                <strong className="text-ink">Cava:</strong> inventario de
                botellas (nombre, bodega, ubicación en el mueble, valoraciones,
                notas, fotos de etiquetas que subas) e historial de
                descorches/movimientos que registres.
              </li>
              <li>
                <strong className="text-ink">Red (opt-in):</strong> si activas
                “Aparecer en la red” o “Cava pública”, el nombre, país, ciudad y
                bio que indiques pueden ser visibles a otros usuarios. Si
                activas “Cava pública”, también se muestran tus vinos (sin
                precios ni mapa de botellas).
              </li>
              <li>
                <strong className="text-ink">Uso técnico:</strong> datos
                necesarios para operar el servicio (sesión, seguridad, logs
                básicos de errores). No vendemos tu información.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              3. Para qué los usamos
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
              <li>Crear y mantener tu cuenta y tu cava.</li>
              <li>
                Generar historias y valoraciones asistidas por IA a partir de
                los datos de la botella que indiques (p. ej. investigación de
                vino).
              </li>
              <li>
                Mostrarte en el directorio y, si activaste “Cava pública”,
                permitir que otros te encuentren por tu handle (@…) y vean tus
                vinos (sin precios). Tu correo no se muestra ni se busca en la
                Red.
              </li>
              <li>Mejorar la seguridad, estabilidad y experiencia del producto.</li>
              <li>
                Comunicarnos contigo sobre el servicio cuando sea necesario
                (p. ej. recuperación de contraseña).
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              4. Inicio de sesión con Google
            </h2>
            <p className="text-ink-soft">
              Si eliges “Continuar con Google”, Google autentica tu identidad y
              nos entrega la información mínima necesaria para crear o abrir tu
              sesión. El uso de Google está sujeto además a la{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink underline-offset-2 hover:underline"
              >
                Política de privacidad de Google
              </a>
              . Puedes revocar el acceso desde la configuración de tu cuenta de
              Google.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              5. Encargados y almacenamiento
            </h2>
            <p className="text-ink-soft">
              Usamos proveedores de infraestructura para alojar la app y la
              base de datos (p. ej. Supabase / hosting en la nube). Tus datos de
              cava y perfil se almacenan de forma asociada a tu cuenta, con
              controles de acceso (incluida seguridad a nivel de fila cuando
              aplica). Las fotos de etiquetas se guardan en almacenamiento
              privado de tu cuenta.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">6. Compartición</h2>
            <p className="text-ink-soft">
              No vendemos datos personales. Compartimos información solo: (a)
              contigo, dentro de tu cuenta; (b) con otros usuarios de Cavatale
              si activaste la red o hiciste pública tu cava (perfil y, en ese
              caso, vinos sin precios); (c) con proveedores que nos ayudan a
              operar el servicio, bajo obligaciones de confidencialidad; (d)
              cuando la ley lo exija.
            </p>
            <p className="text-ink-soft">
              El mapa de botellas, precios y datos de compra no se publican en
              la red. Solo compartes vinos si activas “Cava pública”.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">7. Conservación</h2>
            <p className="text-ink-soft">
              Conservamos tu información mientras mantengas una cuenta activa o
              mientras sea necesaria para prestar el servicio y cumplir
              obligaciones legales. Puedes solicitar la eliminación de tu
              cuenta escribiendo a{" "}
              <a
                href="mailto:hello@lumien.org"
                className="text-ink underline-offset-2 hover:underline"
              >
                hello@lumien.org
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">8. Tus derechos</h2>
            <p className="text-ink-soft">
              Según la legislación aplicable (incluida, cuando corresponda, la
              LFPDPPP en México u otras normas), puedes solicitar acceso,
              rectificación, cancelación u oposición al tratamiento de tus
              datos, así como la eliminación de la cuenta. Contáctanos en el
              correo anterior. También puedes editar tu nombre y tu presencia
              en la red desde la propia aplicación.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">
              9. Menores de edad
            </h2>
            <p className="text-ink-soft">
              Cavatale está pensada para adultos. No está dirigida a menores de
              la edad legal para consumir alcohol en tu jurisdicción. Si crees
              que un menor nos facilitó datos, escríbenos para eliminarlos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">10. Cambios</h2>
            <p className="text-ink-soft">
              Podemos actualizar esta política. La fecha de “última
              actualización” reflejará el cambio. El uso continuado del
              servicio tras la publicación implica el conocimiento de la
              versión vigente.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-medium text-ink">11. Contacto</h2>
            <p className="text-ink-soft">
              Privacidad y soporte:{" "}
              <a
                href="mailto:hello@lumien.org"
                className="text-ink underline-offset-2 hover:underline"
              >
                hello@lumien.org
              </a>
              <br />
              Sitio:{" "}
              <a
                href="https://cavatale.com"
                className="text-ink underline-offset-2 hover:underline"
              >
                https://cavatale.com
              </a>
            </p>
          </section>
        </article>

        <p className="mt-12 text-sm text-ink-soft">
          <Link href="/" className="underline-offset-2 hover:underline">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
