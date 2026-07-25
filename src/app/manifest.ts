import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cavatale",
    short_name: "Cavatale",
    description:
      "Tu cava de vinos con historias que abren conversación.",
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
        src: "/icons/icon-192-v2.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-v2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-v2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
