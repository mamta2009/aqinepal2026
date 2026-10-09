import {
  Activity,
  CircleCheck,
  CircleX,
  Gauge,
  ThermometerSun,
  Wind,
} from "lucide-react";
import { SectionHeading } from "@/components/education/section-heading";
import { Reveal } from "@/components/ui/reveal";

const terms = [
  {
    term: "AQI",
    explanation:
      "A simple air-quality score (often from 0 toward 500). Use this number and its colour band first — lower is generally cleaner.",
    icon: Gauge,
  },
  {
    term: "PM2.5",
    explanation:
      "Fine particle pollution measured in micrograms. Optional detail behind the AQI score for people who want more context.",
    icon: Wind,
  },
  {
    term: "Heat index",
    explanation:
      "A way to understand how hot the weather feels, not only the temperature on a thermometer.",
    icon: ThermometerSun,
  },
] as const;

const statuses = [
  {
    title: "Good",
    text: "Most people can continue normal outdoor activity.",
    className: "bg-green-50 text-aq-good",
    icon: CircleCheck,
  },
  {
    title: "Moderate",
    text: "Sensitive people may need more breaks outdoors.",
    className: "bg-yellow-50 text-aq-moderate",
    icon: Activity,
  },
  {
    title: "Use extra care",
    text: "Consider shorter or gentler outdoor activity.",
    className: "bg-orange-100 text-aq-sensitive",
    icon: Activity,
  },
  {
    title: "Unhealthy",
    text: "Limit strenuous outdoor activity where possible.",
    className: "bg-red-50 text-aq-unhealthy",
    icon: CircleX,
  },
] as const;

export function AirBasics() {
  return (
    <section className="section-space" id="learn">
      <div className="page-shell grid gap-12 lg:grid-cols-2 lg:items-start">
        <div>
          <Reveal>
            <SectionHeading
              eyebrow="Climate conditions made simple"
              title="What are we measuring?"
              lede="Air and heat can affect outdoor activity even when the sky looks fine. These readings help explain local conditions in plain language."
            />
          </Reveal>
          <ul className="mt-9 grid list-none gap-4 p-0">
            {terms.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.term}>
                  <Reveal delay={0.05 * index}>
                    <div className="flex gap-4 rounded-2xl border border-border bg-white p-5">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-soft text-link">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <div>
                        <p className="font-heading text-lg font-extrabold">
                          {item.term}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {item.explanation}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
        <Reveal delay={0.08}>
          <div className="rounded-[2rem] bg-ink p-6 text-white shadow-xl sm:p-8">
            <p className="eyebrow !text-sky-soft">A quick colour guide</p>
            <h3 className="text-3xl font-bold">
              Read the meaning, not only the colour
            </h3>
            <div className="mt-7 grid gap-3">
              {statuses.map((status) => {
                const Icon = status.icon;
                return (
                  <div
                    key={status.title}
                    className="flex items-center gap-4 rounded-2xl bg-white p-4 text-ink"
                  >
                    <span
                      className={`grid size-11 shrink-0 place-items-center rounded-full ${status.className}`}
                    >
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <div>
                      <p className="font-extrabold">{status.title}</p>
                      <p className="text-sm text-muted">{status.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
