"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { NavAlert } from "./nav-alert";

const links = [
  { href: "/dashboard", label: "Today’s air" },
  { href: "/map", label: "Map" },
  { href: "/guides", label: "Guides" },
  { href: "/users", label: "Account" },
  { href: "/about", label: "About" },
  { href: "/help/aqi-help", label: "aqiHelp" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur">
      <nav
        className="page-shell flex min-h-18 items-center gap-4"
        aria-label="Primary"
      >
        <Link
          href="/"
          className="mr-auto inline-flex min-h-11 items-center gap-2.5 font-heading text-lg font-extrabold text-forest-dark"
        >
          <Image
            src="/climate-compass-logo-192.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11"
            priority
          />
          <span>Climate Compass</span>
        </Link>
        <button
          className="inline-grid size-11 place-items-center rounded-full border border-border-strong bg-white text-ink md:hidden"
          type="button"
          aria-expanded={open}
          aria-controls="primary-nav-links"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <div
          id="primary-nav-links"
          className={cn(
            "absolute top-full right-0 left-0 border-b border-border bg-white p-4 shadow-lg md:static md:flex md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none",
            open ? "grid" : "hidden md:flex",
          )}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-ink-soft hover:bg-surface-tint hover:text-forest aria-[current=page]:bg-surface-tint aria-[current=page]:text-forest"
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 md:my-0 md:ml-2">
            <NavAlert />
          </div>
          <Link
            href="/registration"
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-4 text-sm font-extrabold text-white hover:bg-forest-dark md:mt-0 md:ml-2"
            onClick={() => setOpen(false)}
          >
            Get alerts
          </Link>
        </div>
      </nav>
    </header>
  );
}
