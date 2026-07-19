import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          className="display text-2xl tracking-tight text-ink"
        >
          Mi Cava
        </Link>
        <div className="mt-10 flex flex-1 flex-col justify-center">
          <h1 className="display text-4xl text-ink">Entrar</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Tu inventario, mapa e historial — solo tuyos.
          </p>
          <div className="mt-8">
            <Suspense fallback={<p className="text-sm text-ink-soft">Cargando…</p>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
