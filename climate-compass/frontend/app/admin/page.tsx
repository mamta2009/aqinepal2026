import type { Metadata } from "next";
import { OverviewPanel } from "@/components/admin/overview-panel";

export const metadata: Metadata = {
  title: "Status and activity",
};

export default function AdminStatusPage() {
  return <OverviewPanel />;
}
