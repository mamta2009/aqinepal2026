import type { Metadata } from "next";
import { AudiencePage } from "@/components/education/audience-page";
import { audiencePages } from "@/lib/content/education-pages";

export const metadata: Metadata = {
  title: "Clean-air learning for students",
  description:
    "A practical Grades 6–8 introduction to AQI, PM2.5, air observation, and clean-air action.",
};

export default function StudentsPage() {
  return <AudiencePage content={audiencePages.students} />;
}
