"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Status & activity" },
  { href: "/admin/enrollees", label: "Enrollees" },
] as const;

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function AdminNav() {
  const pathname = normalizePath(usePathname());

  return (
    <nav
      className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm"
      aria-label="Operator pages"
    >
      {LINKS.map((link) => {
        const active = pathname === normalizePath(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-extrabold transition-colors ${active ? "bg-forest text-white" : "text-ink hover:bg-surface-tint"
              }`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
