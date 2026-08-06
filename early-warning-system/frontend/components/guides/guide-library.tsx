import { ResourceCard } from "@/components/education/resource-card";
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

  return (
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
  );
}
