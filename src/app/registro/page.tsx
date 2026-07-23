import { BrandMark } from "@/components/BrandMark";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <BrandMark size="sm" />
        <div className="mt-10 flex flex-1 flex-col justify-center">
          <h1 className="display text-4xl text-ink">Crear mi cava</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Gratis. Cada quien con su propia cava — y sus historias — en la
            nube.
          </p>
          <div className="mt-8">
            <RegisterForm />
          </div>
        </div>
      </div>
    </main>
  );
}
