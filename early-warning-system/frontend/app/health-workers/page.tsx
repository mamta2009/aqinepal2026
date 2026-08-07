import type { Metadata } from "next";
import { AudiencePage } from "@/components/education/audience-page";
import { audiencePages } from "@/lib/content/education-pages";

export const metadata: Metadata = {
  title: "Climate information for health workers",
  description:
    "Monitor local air, heat, and rain near your facility, register for alerts, and use informational guides alongside clinical and official guidance.",
};

export default function HealthWorkersPage() {
  return <AudiencePage content={audiencePages.healthWorkers} />;
}
