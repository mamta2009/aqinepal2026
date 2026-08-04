import type { Metadata } from "next";
import { AccountNotificationsPage } from "@/components/account/account-dashboard";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Review alerts and messages sent to your account.",
};

export default function UsersNotificationsPage() {
  return <AccountNotificationsPage />;
}
