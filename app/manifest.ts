import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT, APP_TAGLINE } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_SHORT,
    description: APP_TAGLINE,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7faf8",
    theme_color: "#2f9e57",
    lang: "id",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Anak Saya", url: "/anak", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Jadwal", url: "/jadwal", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
