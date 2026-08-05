import { Suspense } from "react";
import { BrandMark } from "@/components/BrandMark";
import {
  AuthLoadingFallback,
  AuthPageFooter,
  AuthPageHeader,
} from "@/components/AuthPageHeader";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <BrandMark size="sm" />
        <div className="mt-10 flex flex-1 flex-col justify-center">
          <AuthPageHeader
            titleKey="auth.loginTitle"
            subtitleKey="auth.loginLead"
          />
          <div className="mt-8">
            <Suspense fallback={<AuthLoadingFallback />}>
              <LoginForm />
            </Suspense>
          </div>
          <AuthPageFooter />
        </div>
      </div>
    </main>
  );
}
