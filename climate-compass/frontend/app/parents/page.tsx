import type { Metadata } from "next";
import { AudiencePage } from "@/components/education/audience-page";
import { audiencePages } from "@/lib/content/education-pages";

export const metadata: Metadata = {
  title: "Air-quality guidance for parents",
  description:
    "Practical air-quality guidance for outdoor play, family routines, and children who may be sensitive to pollution.",
};

export default function ParentsPage() {
  return <AudiencePage content={audiencePages.parents} />;
}
