import type { Metadata } from "next";
import { BookOpenCheck, Code2, Compass, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/education/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn why Climate Compass is built as an open-source climate-health product for air and heat awareness.",
};

const principles = [
  {
    title: "Education first",
    text: "Plain language and useful questions come before technical detail.",
    icon: BookOpenCheck,
  },
  {
    title: "Actionable context",
    text: "Measurements are connected to everyday choices at home, school, work, and in the community.",
    icon: Compass,
  },
  {
    title: "Open-source",
    text: "The product can be inspected, adapted, and improved by its community.",
    icon: Code2,
  },
  {
    title: "Honest boundaries",
    text: "Illustrative content and service limits are labelled clearly.",
    icon: ShieldCheck,
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <div className="page-shell max-w-4xl">
          <Reveal>
            <p className="eyebrow">About Climate Compass</p>
            <h1 className="text-5xl leading-[1.05] font-extrabold tracking-[-0.04em] sm:text-6xl">
              Environmental information people can use
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-9 text-muted">
              Climate Compass is an open-source product that helps school
              administrators, teachers, parents, health workers, and community
              members check air and heat and respond when conditions need
              attention.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <Reveal>
            <SectionHeading
              eyebrow="Our approach"
              title="Clarity, usefulness, and trust"
              lede="The product is designed to make environmental data easier to learn from without overstating what a digital service can know."
            />
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {principles.map((principle, index) => {
              const Icon = principle.icon;
              return (
                <Reveal key={principle.title} delay={0.06 * index}>
                  <Card className="flex h-full gap-5">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-soft text-link">
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <div>
                      <h2 className="text-xl font-bold">{principle.title}</h2>
                      <p className="mt-2 leading-7 text-muted">
                        {principle.text}
                      </p>
                    </div>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-space">
        <div className="page-shell grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div>
              <SectionHeading
                eyebrow="What it is"
                title="A public-interest climate solution"
              />
              <p className="section-lede mt-5">
                Climate Compass combines configured environmental data with clear
                status guidance, alert registration, and optional learning
                resources. Its source code and documentation support review and
                responsible adaptation.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <aside className="rounded-[2rem] bg-ink p-8 text-white">
              <h2 className="text-2xl font-bold">What it is not</h2>
              <p className="mt-4 leading-7 text-white/75">
                It is not medical advice, an emergency service, or an official
                government forecast. It does not claim endorsement, support, or
                partnership by UNICEF or any other organisation unless that
                relationship is separately published in writing.
              </p>
            </aside>
          </Reveal>
        </div>
      </section>

      <section className="bg-forest py-14 text-white">
        <Reveal amount={0.35}>
          <div className="page-shell flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="max-w-2xl text-3xl font-bold">
              Explore the learning resources or check current conditions.
            </h2>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/guides" variant="secondary" className="bg-white">
                Browse guides
              </ButtonLink>
              <ButtonLink
                href="/dashboard"
                variant="secondary"
                className="border-white bg-transparent text-white hover:bg-white hover:text-forest"
              >
                Check today&apos;s conditions
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
