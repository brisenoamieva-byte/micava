import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mi Cava",
    short_name: "Mi Cava",
    description:
      "Tu inventario y mapa de vinos — en la nube, solo tuyos.",
    start_url: "/cava",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#e5e2da",
    theme_color: "#e5e2da",
    lang: "es",
    categories: ["lifestyle", "food"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
