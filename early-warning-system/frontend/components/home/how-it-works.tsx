import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/education/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { processSteps } from "@/lib/content/education-pages";

export function HowItWorks() {
  return (
    <section className="section-space bg-surface-tint">
      <div className="page-shell">
        <SectionHeading
          eyebrow="From numbers to decisions"
          title="Start with the question you need answered"
          lede="Climate Compass gives context before detail so you can decide what to do next — at home, at work, or in the community."
        />
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative">
                <div className="mb-5 flex items-center gap-4">
                  <span className="grid size-14 place-items-center rounded-2xl bg-forest text-white">
                    <Icon aria-hidden="true" className="size-7" />
                  </span>
                  <span className="font-heading text-sm font-extrabold text-forest">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-2xl font-bold">{step.title}</h3>
                <p className="mt-3 max-w-sm leading-7 text-muted">{step.text}</p>
              </li>
            );
          })}
        </ol>
        <ButtonLink href="/dashboard" size="lg" className="mt-10">
          See today&apos;s recommendations
          <ArrowRight aria-hidden="true" className="size-4" />
        </ButtonLink>
      </div>
    </section>
  );
}
