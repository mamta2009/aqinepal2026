import { Check, CloudSun, Sun } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

const RAIN_DROPS = [
  { left: "16%", delay: "0s", duration: "1.55s", height: "15px" },
  { left: "28%", delay: "0.3s", duration: "1.7s", height: "18px" },
  { left: "40%", delay: "0.6s", duration: "1.45s", height: "16px" },
  { left: "52%", delay: "0.15s", duration: "1.8s", height: "19px" },
  { left: "64%", delay: "0.75s", duration: "1.6s", height: "17px" },
  { left: "76%", delay: "0.45s", duration: "1.65s", height: "18px" },
  { left: "34%", delay: "1.05s", duration: "1.5s", height: "14px" },
  { left: "58%", delay: "1.2s", duration: "1.55s", height: "16px" },
] as const;

const SUN_RAYS = [
  { angle: 0, delay: "0s", duration: "1.9s", length: "18px" },
  { angle: 45, delay: "0.35s", duration: "2.1s", length: "16px" },
  { angle: 90, delay: "0.7s", duration: "1.85s", length: "17px" },
  { angle: 135, delay: "0.2s", duration: "2.2s", length: "15px" },
  { angle: 180, delay: "0.9s", duration: "2s", length: "18px" },
  { angle: 225, delay: "0.5s", duration: "1.95s", length: "16px" },
  { angle: 270, delay: "1.1s", duration: "2.05s", length: "17px" },
  { angle: 315, delay: "0.15s", duration: "2s", length: "15px" },
] as const;

const CLOUD_EMOJIS = [
  { emoji: "☁️", className: "hero-cloud-float left-2 top-10 text-3xl", delay: "0s" },
  { emoji: "☁️", className: "hero-cloud-float-alt left-14 top-2 text-2xl", delay: "0.4s" },
  { emoji: "☁️", className: "hero-cloud-float left-[42%] top-6 text-3xl", delay: "0.8s" },
  { emoji: "☁️", className: "hero-cloud-float-alt right-20 top-14 text-2xl", delay: "1.1s" },
] as const;

export function HomeHero() {
  return (
    <section className="overflow-hidden py-16 sm:py-24">
      <div className="page-shell grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <div>
            <p className="eyebrow">Climate-Health Alerts</p>
            <h1 className="max-w-4xl text-5xl leading-[1.02] font-extrabold tracking-[-0.045em] text-ink sm:text-7xl">
              How are the air, heat, and rain near you?
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              See outdoor air, heat, and rain together for the places you care
              about.
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
              {["Place-based air, heat, and rain checks", "Alert notifications"].map(
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
        </Reveal>
        <Reveal delay={0.08}>
          <div className="relative mx-auto w-full max-w-lg">
            <div className="hero-sun-glow absolute -top-4 right-0 size-40 rounded-full bg-amber-100/25 blur-3xl" />
            <div className="absolute inset-8 rounded-full bg-sky/28 blur-3xl" />

            <div className="hero-sun-wrap absolute top-0 right-3 z-20 size-[4.5rem] overflow-visible">
              <div className="hero-sun-rays" aria-hidden="true">
                {SUN_RAYS.map((ray) => (
                  <span
                    key={ray.angle}
                    className="hero-sun-ray-arm"
                    style={{ transform: `rotate(${ray.angle}deg)` }}
                  >
                    <span
                      className="hero-sun-ray"
                      style={{
                        height: ray.length,
                        animationDelay: ray.delay,
                        animationDuration: ray.duration,
                        background:
                          "linear-gradient(180deg, rgb(245 186 80 / 45%), rgb(245 186 80 / 22%), rgb(245 186 80 / 0%))",
                      }}
                    />
                  </span>
                ))}
              </div>
              <div className="hero-sun-badge relative z-10 grid size-full place-items-center rounded-full bg-amber-100/85 text-amber-600 shadow-md ring-4 ring-amber-50/80">
                <Sun aria-hidden="true" className="hero-sun-spin size-9" />
              </div>
            </div>

            {CLOUD_EMOJIS.map((cloud) => (
              <span
                key={`${cloud.emoji}-${cloud.className}`}
                className={`pointer-events-none absolute z-20 select-none drop-shadow-sm ${cloud.className}`}
                style={{ animationDelay: cloud.delay }}
                aria-hidden="true"
              >
                {cloud.emoji}
              </span>
            ))}

            <div className="relative mx-auto aspect-square w-[88%] overflow-hidden rounded-[3rem] bg-gradient-to-br from-sky-soft via-white to-surface-tint p-10 shadow-[0_24px_80px_rgba(23,50,68,0.12)]">
              <div
                className="hero-rain pointer-events-none absolute inset-x-0 top-0 bottom-[32%] z-10"
                aria-hidden="true"
              >
                {RAIN_DROPS.map((drop) => (
                  <span
                    key={`${drop.left}-${drop.delay}`}
                    className="hero-rain-drop absolute top-0 w-0.5 rounded-full"
                    style={{
                      left: drop.left,
                      height: drop.height,
                      animationDelay: drop.delay,
                      animationDuration: drop.duration,
                      background:
                        "linear-gradient(180deg, rgb(154 214 242 / 35%), rgb(100 180 220 / 30%))",
                    }}
                  />
                ))}
              </div>
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
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-soft text-link">
                <CloudSun aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="font-extrabold text-ink">
                  Start with a nearby city
                </p>
                <p className="mt-1 text-sm text-muted">
                  Then register if you want alerts when conditions change.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
