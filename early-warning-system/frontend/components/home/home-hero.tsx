import { Check, CloudSun } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";

export function HomeHero() {
  return (
    <section className="overflow-hidden py-16 sm:py-24">
      <div className="page-shell grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="eyebrow">Climate-Health Alerts</p>
          <h1 className="max-w-4xl text-5xl leading-[1.02] font-extrabold tracking-[-0.045em] text-ink sm:text-7xl">
            Know the climate around you. Act when it matters.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
            Climate Compass helps you check air and heat for selected places and
            get notified when conditions change — for school administrators,
            teachers, parents, and health workers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/dashboard" size="lg">
              Check today&apos;s conditions
            </ButtonLink>
            <ButtonLink href="/registration" variant="secondary" size="lg">
              Register alerts
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-ink-soft">
            {["Place-based air and heat checks", "Alert notifications"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-surface-tint text-forest">
                    <Check aria-hidden="true" className="size-4" />
                  </span>
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute inset-8 rounded-full bg-sky/35 blur-3xl" />
          <div className="absolute top-2 right-6 z-10 grid size-14 place-items-center rounded-full bg-amber-100 text-amber-600 shadow-md ring-4 ring-white/80">
            <CloudSun aria-hidden="true" className="size-7" />
          </div>
          <div className="relative mx-auto aspect-square w-[88%] rounded-[3rem] bg-gradient-to-br from-sky-soft via-amber-50/80 to-surface-tint p-10 shadow-[0_24px_80px_rgba(23,50,68,0.12)]">
            <Image
              src="/climate-compass-logo-512.png"
              alt="Climate Compass: mountain, sun, wind, water, and leaf"
              fill
              priority
              sizes="(max-width: 1024px) 80vw, 38vw"
              className="object-contain p-10"
            />
          </div>
          <div className="relative -mt-12 ml-auto flex max-w-sm gap-3 rounded-2xl border border-border bg-white p-5 shadow-xl">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
              <CloudSun aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="font-extrabold text-ink">
                Check here for air and heat information in one place!
              </p>
              <p className="mt-1 text-sm text-muted">
                Start with a nearby city, then register if you want alerts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
