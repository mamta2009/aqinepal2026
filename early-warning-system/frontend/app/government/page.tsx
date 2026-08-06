import type { Metadata } from "next";
import { AudiencePage } from "@/components/education/audience-page";
import { audiencePages } from "@/lib/content/education-pages";

export const metadata: Metadata = {
  title: "Climate information for government officials",
  description:
    "Review air and heat across major Nepal cities, share a common status picture with partners, and register for alerts when conditions change.",
};

export default function GovernmentPage() {
  return <AudiencePage content={audiencePages.government} />;
}
