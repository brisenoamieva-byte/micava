import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { AuthProvider } from "@/lib/auth-store";
import { CellarProvider } from "@/lib/cellar-store";
import { PasswordRecoveryRedirect } from "@/components/PasswordRecoveryRedirect";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mi Cava — Tu cava, en orden",
  description:
    "Administra tu cava de vinos con claridad: inventario, mapa, filtros y recomendaciones para tomar o regalar.",
  applicationName: "Mi Cava",
  appleWebApp: {
    capable: true,
    title: "Mi Cava",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#e5e2da",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${cormorant.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AuthProvider>
          <CellarProvider>
            <PasswordRecoveryRedirect />
            {children}
            <PwaRegister />
          </CellarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
