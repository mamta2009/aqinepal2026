import type { Metadata } from "next";
import { EnvironmentOverview } from "@/components/maps/environment-overview";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Environmental Map",
  description:
    "Accessible geographic overview of air quality and heat conditions across major cities in Nepal.",
};

export default function MapPage() {
  return (
    <div className="page-shell py-8 sm:py-12">
      <Reveal>
        <header className="max-w-3xl">
          <p className="eyebrow">National conditions</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Air and heat across Nepal
          </h1>
          <p className="mt-3 text-muted">
            A schematic map and complete data table for major cities. This view
            uses the backend environmental overview and never treats color as the
            only status signal.
          </p>
        </header>
      </Reveal>
      <div className="mt-7">
        <EnvironmentOverview />
      </div>
    </div>
  );
}
