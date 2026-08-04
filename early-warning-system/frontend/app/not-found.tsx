import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="page-shell section-space text-center">
      <p className="eyebrow">Page not found</p>
      <h1 className="section-title">This path is not on the compass.</h1>
      <p className="section-lede mx-auto mt-4">
        Return home or check today’s air for your nearest city.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary">
          Check today’s air
        </ButtonLink>
      </div>
    </section>
  );
}
