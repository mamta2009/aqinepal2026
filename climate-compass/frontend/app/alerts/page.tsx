import type { Metadata } from "next";
import { AlertsDetail } from "@/components/alerts/alerts-detail";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Alerts",
  description:
    "View the latest public Climate Compass alert broadcast for Nepal cities, including hazard, level, and delivery summary.",
};

export default function AlertsPage() {
  return (
    <div className="page-shell py-8 sm:py-12">
      <Reveal>
        <header className="max-w-3xl">
          <p className="eyebrow">Public broadcasts</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Latest alert details
          </h1>
          <p className="mt-3 text-muted">
            This page shows the most recent row from the real alert_broadcasts
            log for your saved city — the same place used on Today&apos;s
            conditions. It is not a live PM2.5 threshold calculator.
          </p>
        </header>
      </Reveal>
      <div className="mt-7">
        <AlertsDetail />
      </div>
    </div>
  );
}
