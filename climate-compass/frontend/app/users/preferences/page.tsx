import type { Metadata } from "next";
import { AccountPreferencesPage } from "@/components/account/account-dashboard";

export const metadata: Metadata = {
  title: "Preferences",
  description: "Update alert channels, topics, and language preferences.",
};

export default function UsersPreferencesPage() {
  return <AccountPreferencesPage />;
}
