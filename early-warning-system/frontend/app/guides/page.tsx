import type { Metadata } from "next";
import { GuidesIndexClient } from "@/components/guides/guides-index-client";

export const metadata: Metadata = {
  title: "Learning resources and guides",
  description:
    "Climate Compass learning resources for schools and families, plus technical guides on how live air, heat, and weather data are fetched.",
};

export default function GuidesPage() {
  return <GuidesIndexClient />;
}
