import { BrandMark } from "@/components/BrandMark";
import { RegisterForm } from "@/components/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <BrandMark size="sm" />
        <div className="mt-10 flex flex-1 flex-col justify-center">
          <h1 className="display text-4xl text-ink">Crear mi cava</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Gratis. En minutos puedes:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
            <li>· Guardar botellas con una foto de la etiqueta</li>
            <li>· Verlas en el mapa de tu mueble</li>
            <li>· Leer la historia del vino al abrirlo</li>
          </ul>
          <div className="mt-8">
            <RegisterForm />
          </div>
          <p className="mt-6 text-center text-xs text-ink-soft">
            Al continuar aceptas nuestras{" "}
            <Link
              href="/terminos"
              className="text-ink underline-offset-2 hover:underline"
            >
              Condiciones del servicio
            </Link>{" "}
            y la{" "}
            <Link
              href="/privacidad"
              className="text-ink underline-offset-2 hover:underline"
            >
              Política de privacidad
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
