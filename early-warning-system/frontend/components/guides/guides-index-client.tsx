"use client";

import { useQuery } from "@tanstack/react-query";
import { GuideLibrary } from "@/components/guides/guide-library";
import { Reveal } from "@/components/ui/reveal";
import { api } from "@/lib/api/endpoints";
import { knownResources } from "@/lib/content/education-pages";
import type { GuideResource } from "@/lib/api/types";

const fallbackGuides: GuideResource[] = knownResources.map((resource) => {
  const path = resource.href.replace(/^\/guides\/md\//, "");
  return {
    path,
    slug: path.replace(/\.md$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: resource.title,
    summary: resource.description,
    audience: resource.audience,
  };
});

export function GuidesIndexClient() {
  const query = useQuery({
    queryKey: ["guides", "index"],
    queryFn: async () => {
      const result = await api.guides.list();
      return result.resources.length ? result.resources : fallbackGuides;
    },
    staleTime: 5 * 60 * 1000,
  });

  const guides = query.data ?? fallbackGuides;

  return (
    <div className="page-shell py-16 sm:py-24">
      <Reveal>
        <header className="max-w-4xl">
          <p className="eyebrow">Learning centre</p>
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-[-0.04em] sm:text-6xl">
            Explore climate learning with Climate Compass
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted">
            Practical guides for using Climate Compass and understanding air,
            heat, and outdoor conditions at school and at home.
          </p>
        </header>
      </Reveal>
      <section className="mt-12" aria-label="Climate Compass resources">
        {query.isPending ? (
          <p className="text-muted" role="status">
            Loading guides…
          </p>
        ) : (
          <GuideLibrary guides={guides} />
        )}
      </section>
    </div>
  );
}
