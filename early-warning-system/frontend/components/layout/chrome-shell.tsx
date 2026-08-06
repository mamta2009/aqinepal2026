"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { FloatingHelpLauncher } from "@/components/aqi-help/floating-help-launcher";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function ChromeShell({ children }: { children: React.ReactNode }) {
  const pathname = normalizePath(usePathname());
  const searchParams = useSearchParams();
  const embed =
    pathname === "/help/aqi-help" && searchParams.get("embed") === "1";
  const hideHelp =
    embed || pathname === "/help/aqi-help" || pathname.startsWith("/admin");

  if (embed) {
    return <div className="min-h-0 bg-white">{children}</div>;
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
