import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "@/components/education/section-heading";
import { Card } from "@/components/ui/card";
import { audiencePathways } from "@/lib/content/education-pages";

export function AudiencePathways() {
  return (
    <section className="section-space bg-white">
      <div className="page-shell">
        <SectionHeading
          eyebrow="Who uses Climate Compass"
          title="Built for people who need timely air and heat information"
          lede="Schools are one important setting — but not the whole story. The same tools support clinics, offices, families, and public agencies."
          align="center"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {audiencePathways.map((pathway) => {
            const Icon = pathway.icon;
            return (
              <Card
                key={pathway.title}
                className="group flex flex-col border-0 bg-surface shadow-none transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-sky-soft text-link">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <h3 className="text-xl font-bold">{pathway.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-muted">
                  {pathway.text}
                </p>
                <Link
                  href={pathway.href}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 font-extrabold text-link"
                >
                  Get started
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
