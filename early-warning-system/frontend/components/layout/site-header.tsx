"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAccountProfile } from "@/hooks/use-account";
import { cn } from "@/lib/utils/cn";
import { NavAlert } from "./nav-alert";

const links = [
  { href: "/dashboard", label: "Today’s conditions" },
  { href: "/map", label: "Map" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
  { href: "/help/aqi-help", label: "aqiHelp" },
];

function sessionLabel(profile: {
  name?: string;
  email?: string;
  facility_name?: string;
}) {
  const name = profile.name?.trim();
  if (name) return name;
  const facility = profile.facility_name?.trim();
  if (facility) return facility;
  return profile.email?.trim() || "My account";
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const profile = useAccountProfile();
  const signedIn = Boolean(profile.data);
  const displayName = profile.data ? sessionLabel(profile.data) : "";

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
            className="h-11 w-auto"
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
          {signedIn ? (
            <Link
              href="/users/profile/"
              title={profile.data?.email || displayName}
              aria-label={`Signed in as ${displayName}. Open account.`}
              aria-current={
                pathname === "/users" || pathname.startsWith("/users/")
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex min-h-11 max-w-56 items-center gap-2 rounded-full bg-forest px-4 text-sm font-extrabold text-white hover:bg-forest-dark md:mt-0 md:ml-2"
            >
              <UserRound
                aria-hidden="true"
                className="size-4 shrink-0"
              />
              <span className="truncate">{displayName}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/users/profile/"
                aria-current={
                  pathname === "/users" || pathname.startsWith("/users/")
                    ? "page"
                    : undefined
                }
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong bg-white px-4 text-sm font-extrabold text-ink hover:border-forest hover:bg-surface-tint md:mt-0 md:ml-2"
              >
                Sign in
              </Link>
              <Link
                href="/registration"
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-4 text-sm font-extrabold text-white hover:bg-forest-dark md:mt-0 md:ml-2"
                onClick={() => setOpen(false)}
              >
                Register alerts
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
