import type { Metadata } from "next";
import { AccountProfilePage } from "@/components/account/account-dashboard";

export const metadata: Metadata = {
  title: "Profile",
  description: "View your Climate Compass registrant profile.",
};

export default function UsersProfilePage() {
  return <AccountProfilePage />;
}
