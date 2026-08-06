import type { Metadata } from "next";
import { GuidesIndexClient } from "@/components/guides/guides-index-client";

export const metadata: Metadata = {
  title: "Learning resources and guides",
  description:
    "Clean-air activities and practical guides for Climate Compass students, teachers, parents, and schools.",
};

export default function GuidesPage() {
  return <GuidesIndexClient />;
}
