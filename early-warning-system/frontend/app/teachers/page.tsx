import type { Metadata } from "next";
import { AudiencePage } from "@/components/education/audience-page";
import { audiencePages } from "@/lib/content/education-pages";

export const metadata: Metadata = {
  title: "Clean-air resources for teachers",
  description:
    "Teach Grades 6–8 students about AQI, PM2.5, evidence, health awareness, and community action.",
};

export default function TeachersPage() {
  return <AudiencePage content={audiencePages.teachers} />;
}
