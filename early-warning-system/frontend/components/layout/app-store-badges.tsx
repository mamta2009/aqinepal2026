import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.intelladapt.earlywarningsystem&pcampaignid=web_share";

function GooglePlayMark() {
  return (
    <img
      src="/google-play-icon.svg"
      alt=""
      width={28}
      height={32}
      className="h-7 w-auto shrink-0"
    />
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.37 1.43c0 1.14-.37 2.2-1.07 3.04-.78.92-1.93 1.54-3.05 1.45-.15-1.12.4-2.28 1.08-3.13.76-.95 2.07-1.64 3.04-1.36zM20.5 17.54c-.83 1.38-1.24 1.99-2.34 3.22-1.03 1.14-2.35 2.56-4.05 2.58-1.52.03-1.91-.99-3.98-.99-2.08 0-2.5 1.01-4.02.97-1.66-.05-2.93-1.3-3.96-2.45C.07 18.36-1.3 13.2.88 9.62c1.07-1.75 3-2.94 5.1-2.97 1.6-.03 3.1 1.08 3.98 1.08.86 0 2.47-1.33 4.73-1.13 1.8.07 3.34.9 4.27 2.18-3.92 2.15-3.29 7.74.27 8.76z"
      />
    </svg>
  );
}

function BadgeShell({
  tone,
  className,
  children,
}: {
  tone: "light" | "dark";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[52px] min-w-[168px] items-center gap-3 rounded-xl px-3.5 py-2 shadow-sm",
        tone === "dark"
          ? "bg-white text-ink"
          : "bg-ink text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

function BadgeCopy({
  kicker,
  name,
}: {
  kicker: string;
  name: string;
}) {
  return (
    <span className="flex flex-col leading-none">
      <span className="text-[0.65rem] font-bold tracking-[0.08em] uppercase opacity-80">
        {kicker}
      </span>
      <span className="mt-1 font-heading text-[1.05rem] font-extrabold tracking-tight">
        {name}
      </span>
    </span>
  );
}

export function AppStoreBadges({
  tone = "light",
  heading,
}: {
  tone?: "light" | "dark";
  heading?: string;
}) {
  return (
    <div>
      {heading ? (
        <p
          className={cn(
            "mb-3 text-sm font-bold",
            tone === "dark" ? "text-white/80" : "text-ink-soft",
          )}
        >
          {heading}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get Climate Compass on Google Play"
          className="rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-forest/25 motion-safe:transition-transform motion-safe:hover:-translate-y-px"
        >
          <BadgeShell tone={tone}>
            <GooglePlayMark />
            <BadgeCopy kicker="Get it on" name="Google Play" />
          </BadgeShell>
        </a>
        <span>
          <BadgeShell tone={tone} className="cursor-default opacity-80">
            <AppleMark className="size-7 shrink-0" />
            <BadgeCopy kicker="Coming soon" name="App Store" />
          </BadgeShell>
        </span>
      </div>
    </div>
  );
}
