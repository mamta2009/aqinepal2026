import type { Metadata } from "next";
import { AirBasics } from "@/components/home/air-basics";
import { AudiencePathways } from "@/components/home/audience-pathways";
import { HomeHero } from "@/components/home/home-hero";
import { HomeResources } from "@/components/home/home-resources";
import { HowItWorks } from "@/components/home/how-it-works";
import { Mission } from "@/components/home/mission";

export const metadata: Metadata = {
  title: "Climate checks and alerts",
  description:
    "How is the air near you? Check here for air, heat and rain information in one place.",
};

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <AudiencePathways />
      <AirBasics />
      <HowItWorks />
      <HomeResources />
      <Mission />
    </>
  );
}
