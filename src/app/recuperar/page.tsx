import { BrandMark } from "@/components/BrandMark";
import { AuthPageHeader } from "@/components/AuthPageHeader";
import { RecoverPasswordForm } from "@/components/RecoverPasswordForm";

export default function RecuperarPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <BrandMark size="sm" />
        <div className="mt-10 flex flex-1 flex-col justify-center">
          <AuthPageHeader
            titleKey="auth.recoverTitle"
            subtitleKey="auth.recoverSubtitle"
          />
          <div className="mt-8">
            <RecoverPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}
