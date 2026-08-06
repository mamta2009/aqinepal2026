import type { Metadata } from "next";
import { AccountFacilitiesPage } from "@/components/account/account-dashboard";

export const metadata: Metadata = {
  title: "Facilities",
  description:
    "Manage facilities you cover and log preparedness actions for each site.",
};

export default function UsersFacilitiesPage() {
  return <AccountFacilitiesPage />;
}
