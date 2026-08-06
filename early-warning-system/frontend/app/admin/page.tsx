import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin/admin-console";

export const metadata: Metadata = {
  title: "Operator console",
  description:
    "Secure Climate Compass operator tools for service health, enrolment, audit anchors, and private guidance.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminConsole />;
}
