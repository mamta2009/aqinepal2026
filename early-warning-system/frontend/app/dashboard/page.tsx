import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "Today’s Climate Health Dashboard",
  description:
    "Decision-first air quality, heat, weather, and respiratory health guidance for Bagmati communities.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
