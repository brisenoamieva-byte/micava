import { Suspense } from "react";
import { BrandMark } from "@/components/BrandMark";
import { NewPasswordForm } from "@/components/NewPasswordForm";

export default function NuevaContrasenaPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <BrandMark size="sm" />
        <div className="mt-10 flex flex-1 flex-col justify-center">
          <h1 className="display text-4xl text-ink">Nueva contraseña</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Elige una contraseña nueva para tu cuenta en Cavatale.
          </p>
          <div className="mt-8">
            <Suspense
              fallback={<p className="text-sm text-ink-soft">Cargando…</p>}
            >
              <NewPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
