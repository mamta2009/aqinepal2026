import type { Metadata } from "next";
import { RegistrantsPanel } from "@/components/admin/registrants-panel";

export const metadata: Metadata = {
  title: "Enrollees",
};

export default function AdminEnrolleesPage() {
  return <RegistrantsPanel />;
}
