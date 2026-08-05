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
    "Check air and heat for selected places and get notifications when conditions change. For school administrators, teachers, parents, and health workers.",
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
