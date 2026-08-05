import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  const paths = [
    "/",
    "/dashboard/",
    "/guides/",
    "/about/",
    "/map/",
    "/schools/",
    "/parents/",
    "/teachers/",
    "/students/",
    "/government/",
    "/health-workers/",
    "/registration/",
    "/help/aqi-help/",
    "/privacy-policy/",
    "/delete-account/",
  ];

  return paths.map((path) => ({
    url: `${base}${path === "/" ? "/" : path}`,
    lastModified: new Date(),
    changeFrequency: path === "/dashboard/" ? "hourly" : "weekly",
    priority: path === "/" ? 1 : path === "/dashboard/" ? 0.9 : 0.7,
  }));
}
