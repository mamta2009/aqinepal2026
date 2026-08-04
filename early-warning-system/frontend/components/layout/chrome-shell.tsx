"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { FloatingHelpLauncher } from "@/components/aqi-help/floating-help-launcher";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export function ChromeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const embed =
    pathname === "/help/aqi-help" && searchParams.get("embed") === "1";
  const hideHelp =
    embed ||
    pathname === "/help/aqi-help" ||
    pathname.startsWith("/admin");

  if (embed) {
    return <div className="min-h-screen bg-surface">{children}</div>;
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      {!hideHelp && <FloatingHelpLauncher />}
    </>
  );
}
