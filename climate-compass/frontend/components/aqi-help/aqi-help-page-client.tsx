"use client";

import { useSearchParams } from "next/navigation";
import { AqiHelpChat } from "@/components/aqi-help/aqi-help-chat";

export function AqiHelpPageClient() {
  const embed = useSearchParams().get("embed") === "1";
  return <AqiHelpChat embed={embed} />;
}
