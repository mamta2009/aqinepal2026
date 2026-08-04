import type { Metadata } from "next";
import { Suspense } from "react";
import { AqiHelpChat } from "@/components/aqi-help/aqi-help-chat";
import { AqiHelpPageClient } from "@/components/aqi-help/aqi-help-page-client";

export const metadata: Metadata = {
  title: "aqiHelp",
  description:
    "Ask plain-language questions about air quality, alerts, and Climate Compass guidance.",
};

export default function AqiHelpPage() {
  return (
    <Suspense fallback={<AqiHelpChat />}>
      <AqiHelpPageClient />
    </Suspense>
  );
}
