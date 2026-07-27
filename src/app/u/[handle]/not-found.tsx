import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function PublicHandleNotFound() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <BrandMark size="sm" />
        <div className="mt-12 flex flex-1 flex-col justify-center">
          <h1 className="display text-3xl text-ink">Cava no encontrada</h1>
          <p className="mt-3 text-sm text-ink-soft">
            Ese handle no existe, o la cava ya no es pública.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Link href="/" className="btn btn-primary min-h-[44px] px-4 text-sm">
              Ir a Cavatale
            </Link>
            <Link href="/cava" className="btn btn-ghost min-h-[44px] px-4 text-sm">
              Mi cava
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
