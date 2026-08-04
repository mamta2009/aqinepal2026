import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account/account-dashboard";

export const metadata: Metadata = {
  title: "Registrant account",
  description:
    "Manage your Climate Compass facilities, alert preferences, trusted contacts, and preparedness actions.",
};

export default function UsersPage() {
  return <AccountDashboard />;
}
