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
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cavatale.com"),
  title: "Cavatale — Tu cava, con historias",
  description:
    "Tu cava de vinos en la nube: inventario, mapa e historias que abren conversación al descorchar.",
  applicationName: "Cavatale",
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Cavatale",
    title: "Cavatale — Tu cava, con historias",
    description:
      "Tu cava de vinos en la nube: inventario, mapa e historias que abren conversación al descorchar.",
    url: "https://cavatale.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cavatale — Tu cava, con historias",
    description:
      "Tu cava de vinos en la nube: inventario, mapa e historias que abren conversación al descorchar.",
  },
  appleWebApp: {
    capable: true,
    title: "Cavatale",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
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
    <html
      lang="es"
      className={`${outfit.variable} ${cormorant.variable} h-full`}
    >
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
