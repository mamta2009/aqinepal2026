import { Compass, Info, Scale } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function Mission() {
  return (
    <>
      <section className="section-space">
        <div className="page-shell grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] bg-sky-soft p-7 sm:p-10">
            <span className="mb-6 grid size-12 place-items-center rounded-2xl bg-white text-link">
              <Compass aria-hidden="true" className="size-6" />
            </span>
            <p className="eyebrow">From information to action</p>
            <h2 className="section-title">Why Climate Compass exists</h2>
            <p className="section-lede mt-5">
              Climate Compass helps people check local air and heat in plain
              language, register for alerts when conditions need attention, and
              decide next steps — adjust outdoor plans, share status with a
              group, or follow up with official guidance. The goal is not only
              to know the reading, but to act when it matters.
            </p>
            <ButtonLink href="/about" variant="secondary" className="mt-7">
              Learn about the product
            </ButtonLink>
          </div>
          <aside className="rounded-[2rem] bg-ink p-7 text-white sm:p-10">
            <Info aria-hidden="true" className="size-9 text-sky" />
            <h3 className="mt-5 text-2xl font-bold">Know the limits</h3>
            <p className="mt-4 leading-7 text-white/75">
              Live readings depend on configured data providers. Some charts
              and case examples may be illustrative. This service is not a
              forecast, medical advice, or an official government emergency
              system.
            </p>
            <div className="mt-6 flex gap-3 border-t border-white/15 pt-6 text-sm text-white/70">
              <Scale aria-hidden="true" className="size-5 shrink-0 text-sky" />
              <p>
                Follow local authorities and qualified health professionals
                when making safety or health decisions.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-forest py-14 text-white">
        <div className="page-shell flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-extrabold tracking-widest text-sky-soft uppercase">
              Ready to plan your day?
            </p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold">
              See what today&apos;s conditions mean where you are.
            </h2>
          </div>
          <ButtonLink
            href="/dashboard"
            variant="secondary"
            size="lg"
            className="border-white bg-white"
          >
            Check today&apos;s conditions
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
