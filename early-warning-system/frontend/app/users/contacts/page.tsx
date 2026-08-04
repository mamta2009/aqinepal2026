import type { Metadata } from "next";
import { AccountContactsPage } from "@/components/account/account-dashboard";

export const metadata: Metadata = {
  title: "Trusted contacts",
  description: "Manage people who can receive shared air quality alerts.",
};

export default function UsersContactsPage() {
  return <AccountContactsPage />;
}
