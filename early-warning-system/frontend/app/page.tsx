import type { Metadata } from "next";
import { AirBasics } from "@/components/home/air-basics";
import { AudiencePathways } from "@/components/home/audience-pathways";
import { HomeHero } from "@/components/home/home-hero";
import { HomeResources } from "@/components/home/home-resources";
import { HowItWorks } from "@/components/home/how-it-works";
import { Mission } from "@/components/home/mission";

export const metadata: Metadata = {
  title: "Air quality checks and alerts",
  description:
    "Check air quality for selected places and get notifications when conditions change. For health workers, government officials, administrators, families, and communities.",
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
