import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import { CellarProvider } from "@/lib/cellar-store";
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
  appleWebApp: {
    capable: true,
    title: "Mi Cava",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
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
        <CellarProvider>{children}</CellarProvider>
      </body>
    </html>
  );
}
