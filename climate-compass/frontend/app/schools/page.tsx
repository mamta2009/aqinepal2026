import type { Metadata } from "next";
import { AudiencePage } from "@/components/education/audience-page";
import { audiencePages } from "@/lib/content/education-pages";

export const metadata: Metadata = {
  title: "Air-quality planning for schools",
  description:
    "A practical school routine for assembly, recess, sports, transport, ventilation, and sensitive students.",
};

export default function SchoolsPage() {
  return <AudiencePage content={audiencePages.schools} />;
}
