import { BrandMark } from "@/components/BrandMark";
import { AuthPageFooter, AuthPageHeader } from "@/components/AuthPageHeader";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <BrandMark size="sm" />
        <div className="mt-10 flex flex-1 flex-col justify-center">
          <AuthPageHeader
            titleKey="auth.registerTitle"
            subtitleKey="auth.registerSubtitle"
            subtitleClassName="mt-2 text-sm leading-relaxed text-ink-soft"
          />
          <div className="mt-8">
            <RegisterForm />
          </div>
          <AuthPageFooter />
        </div>
      </div>
    </main>
  );
}
