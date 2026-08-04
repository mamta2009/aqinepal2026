import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ResourceCard } from "@/components/education/resource-card";
import { SectionHeading } from "@/components/education/section-heading";
import { knownResources } from "@/lib/content/education-pages";

export function HomeResources() {
  return (
    <section className="section-space bg-white">
      <div className="page-shell">
        <SectionHeading
          eyebrow="Optional guides"
          title="Go deeper when you need more detail"
          lede="Short resources for families, facilities, and classrooms — useful alongside alerts, not a replacement for them."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {knownResources.map((resource) => (
            <ResourceCard key={resource.href} resource={resource} />
          ))}
        </div>
        <Link
          href="/guides"
          className="mt-8 inline-flex min-h-11 items-center gap-2 font-extrabold text-link hover:text-forest-dark"
        >
          Browse all learning resources
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
