import { Suspense } from "react";
import { BrandMark } from "@/components/BrandMark";
import {
  AuthLoadingFallback,
  AuthPageHeader,
} from "@/components/AuthPageHeader";
import { NewPasswordForm } from "@/components/NewPasswordForm";

export default function NuevaContrasenaPage() {
  return (
    <main className="grain relative min-h-screen min-h-[100dvh]">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
        <BrandMark size="sm" />
        <div className="mt-10 flex flex-1 flex-col justify-center">
          <AuthPageHeader titleKey="auth.newPasswordTitle" />
          <div className="mt-8">
            <Suspense fallback={<AuthLoadingFallback />}>
              <NewPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
