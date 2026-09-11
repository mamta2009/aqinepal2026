import { ResourceCard } from "@/components/education/resource-card";
import { Reveal } from "@/components/ui/reveal";
import type { GuideResource } from "@/lib/api/types";

const educationalPaths = new Set([
  "STUDENT_CLEAN_AIR_ACTIVITY.md",
  "TEACHER_CLEAN_AIR_LESSON.md",
  "PARENT_AIR_QUALITY_CHECKLIST.md",
  "SCHOOL_AIR_QUALITY_ACTION_GUIDE.md",
]);

/** Technical / implementer docs shown under the learning cards on /guides. */
const technicalPaths = [
  "DATA_FETCHING.md",
  "ALERTS_AND_NOTIFICATIONS.md",
  "APPLICATION_OVERVIEW.md",
  "IMPLEMENTATION_SNAPSHOT.md",
  "DASHBOARD_FEATURES.md",
] as const;

function guideHref(path: string) {
  return `/guides/${path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}/`;
}

function GuideGrid({
  guides,
  heading,
}: {
  guides: GuideResource[];
  heading: string;
}) {
  if (!guides.length) return null;
  return (
    <section className="mt-12" aria-label={heading}>
      <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-ink">
        {heading}
      </h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {guides.map((guide, index) => (
          <Reveal key={guide.path} delay={0.06 * index} className="h-full">
            <ResourceCard
              resource={{
                audience: guide.audience || "Climate Compass guide",
                title: guide.title,
                description:
                  guide.summary ||
                  "Open this Climate Compass resource.",
                href: guideHref(guide.path),
              }}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function GuideLibrary({ guides }: { guides: GuideResource[] }) {
  const byPath = new Map(guides.map((guide) => [guide.path, guide]));
  const learning = guides.filter((guide) => educationalPaths.has(guide.path));
  const technical = technicalPaths
    .map((path) => byPath.get(path))
    .filter((guide): guide is GuideResource => Boolean(guide));

  return (
    <div>
      <GuideGrid guides={learning} heading="Learning resources" />
      <GuideGrid guides={technical} heading="How Climate Compass data works" />
    </div>
  );
}
