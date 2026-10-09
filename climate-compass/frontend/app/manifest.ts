import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Climate Compass",
    short_name: "Climate Compass",
    description:
      "Understand air, heat, and rain to make healthier choices for home and school.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fcfd",
    theme_color: "#1f794b",
    icons: [
      {
        src: "/climate-compass-logo-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/climate-compass-logo-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
