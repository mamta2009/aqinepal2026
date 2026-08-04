import type { Metadata } from "next";
import { AccountSecurityPage } from "@/components/account/account-dashboard";

export const metadata: Metadata = {
  title: "Security",
  description: "Delete your Climate Compass registrant account.",
};

export default function UsersSecurityPage() {
  return <AccountSecurityPage />;
}
