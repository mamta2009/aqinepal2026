import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "./section-heading";

type AudiencePageContent = {
  eyebrow: string;
  title: string;
  lede: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  accent: string;
  facts: readonly { title: string; text: string }[];
  activityTitle: string;
  activitySteps: readonly string[];
  resourceHref: string;
  resourceLabel: string;
  primaryHref?: string;
  primaryLabel?: string;
};

export function AudiencePage({ content }: { content: AudiencePageContent }) {
  const Icon = content.icon;
  const primaryHref = content.primaryHref ?? "/dashboard";
  const primaryLabel = content.primaryLabel ?? "Check today's conditions";

  return (
    <>
      <section className="overflow-hidden py-16 sm:py-24">
        <div className="page-shell grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="eyebrow">{content.eyebrow}</p>
            <h1 className="max-w-3xl text-5xl leading-[1.05] font-extrabold tracking-[-0.04em] text-ink sm:text-6xl">
              {content.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              {content.lede}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={primaryHref} size="lg">
                {primaryLabel}
              </ButtonLink>
              <ButtonLink href={content.resourceHref} variant="secondary" size="lg">
                {content.resourceLabel}
              </ButtonLink>
            </div>
          </div>
          <div
            className={`relative mx-auto grid aspect-square w-full max-w-md place-items-center rounded-[3rem] ${content.accent}`}
          >
            <div className="absolute inset-7 rounded-[2.4rem] border-2 border-dashed border-forest/20" />
            <Icon aria-hidden={true} className="size-32 text-forest" />
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading
            eyebrow="Know the basics"
            title="Three ideas to remember"
            lede="Air and heat information is most useful when it supports calm, practical coordination alongside official guidance."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {content.facts.map((fact, index) => (
              <Card key={fact.title} className="border-0 bg-surface-tint shadow-none">
                <span className="mb-5 grid size-10 place-items-center rounded-full bg-forest font-heading font-extrabold text-white">
                  {index + 1}
                </span>
                <h3 className="text-xl font-bold">{fact.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{fact.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="page-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionHeading
            eyebrow="Put it into practice"
            title={content.activityTitle}
            lede="Use the dashboard as one source of evidence, alongside what you observe and guidance from trusted adults and local authorities."
          />
          <ol className="grid gap-4">
            {content.activitySteps.map((step, index) => (
              <li
                key={step}
                className="flex gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm"
              >
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-6 shrink-0 text-forest"
                />
                <div>
                  <span className="text-xs font-extrabold tracking-wider text-forest uppercase">
                    Step {index + 1}
                  </span>
                  <p className="mt-1 font-bold text-ink">{step}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-forest py-14 text-white">
        <div className="page-shell flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold tracking-widest text-sky-soft uppercase">
              Keep learning
            </p>
            <h2 className="mt-2 text-3xl font-bold">Explore more climate resources</h2>
          </div>
          <ButtonLink
            href="/guides"
            variant="secondary"
            size="lg"
            className="border-white bg-white"
          >
            Browse all guides <ArrowRight aria-hidden="true" className="size-4" />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
