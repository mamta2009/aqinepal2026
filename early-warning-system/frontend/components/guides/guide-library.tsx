import { BookOpen, Code2 } from "lucide-react";
import { ResourceCard } from "@/components/education/resource-card";
import { Card, CardKicker } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import type { GuideResource } from "@/lib/api/types";

const educationalPaths = new Set([
  "STUDENT_CLEAN_AIR_ACTIVITY.md",
  "TEACHER_CLEAN_AIR_LESSON.md",
  "PARENT_AIR_QUALITY_CHECKLIST.md",
  "SCHOOL_AIR_QUALITY_ACTION_GUIDE.md",
]);

function guideHref(path: string) {
  return `/guides/${path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}/`;
}

export function GuideLibrary({ guides }: { guides: GuideResource[] }) {
  const learning = guides.filter((guide) => educationalPaths.has(guide.path));
  const technical = guides.filter((guide) => !educationalPaths.has(guide.path));

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {learning.map((guide, index) => (
          <Reveal key={guide.path} delay={0.06 * index} className="h-full">
            <ResourceCard
              resource={{
                audience: guide.audience || "Learning resource",
                title: guide.title,
                description:
                  guide.summary ||
                  "Open this practical Climate Compass resource.",
                href: guideHref(guide.path),
              }}
            />
          </Reveal>
        ))}
      </div>

      {technical.length ? (
        <section className="mt-20">
          <Reveal>
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-soft text-link">
                <Code2 aria-hidden="true" className="size-6" />
              </span>
              <div>
                <p className="eyebrow">For implementers</p>
                <h2 className="section-title">Technical documentation</h2>
                <p className="section-lede mt-4">
                  Architecture, setup, operations, and integration notes for
                  people building or running Climate Compass.
                </p>
              </div>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {technical.map((guide, index) => (
              <Reveal key={guide.path} delay={0.05 * index} className="h-full">
                <Card className="flex h-full flex-col">
                  <BookOpen
                    aria-hidden="true"
                    className="mb-4 size-6 text-forest"
                  />
                  <CardKicker>{guide.audience || "Documentation"}</CardKicker>
                  <h3 className="text-lg font-bold">{guide.title}</h3>
                  {guide.summary ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">
                      {guide.summary}
                    </p>
                  ) : null}
                  <a
                    href={guideHref(guide.path)}
                    className="mt-auto inline-flex min-h-11 items-end pt-4 font-extrabold text-link hover:text-forest-dark"
                  >
                    Read guide →
                  </a>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
