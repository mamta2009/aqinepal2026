import type { Metadata } from "next";
import { AqiHelpChat } from "@/components/aqi-help/aqi-help-chat";

export const metadata: Metadata = {
  title: "aqiHelp",
  description:
    "Ask plain-language questions about air quality, alerts, and Climate Compass guidance.",
};

export default function AqiHelpPage() {
  return <AqiHelpChat />;
}
