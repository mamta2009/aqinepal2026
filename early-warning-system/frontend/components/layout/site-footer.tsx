import Image from "next/image";
import Link from "next/link";

const links = [
  ["/", "Home"],
  ["/dashboard", "Today’s conditions"],
  ["/guides", "Learning resources"],
  ["/registration", "Register alerts"],
  ["/about", "About"],
  ["/privacy-policy", "Privacy Policy"],
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink py-12 text-white">
      <div className="page-shell">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <div className="mb-4 flex items-center gap-3 font-heading text-xl font-bold">
              <Image
                src="/climate-compass-logo-192.png"
                alt=""
                width={44}
                height={44}
              />
              Climate Compass
            </div>
            <p className="text-sm leading-relaxed text-white/75">
              Place-based air and heat checks and alerts for communities across
              Nepal.
            </p>
          </div>
          <nav className="flex max-w-xl flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 items-center text-sm font-bold text-white/80 hover:text-sky"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-white/15 pt-6 text-xs leading-relaxed text-white/65">
          <p>
            Open-source MIT License. An educational demonstration for
            public-interest climate awareness.
          </p>
          <p className="mt-2">
            Not medical or official emergency advice. Partner support or
            endorsement is stated only when separately published in writing.
          </p>
        </div>
      </div>
    </footer>
  );
}
