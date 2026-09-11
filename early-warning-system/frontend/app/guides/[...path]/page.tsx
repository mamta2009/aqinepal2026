import type { Metadata } from "next";
import { GuideDocumentClient } from "@/components/guides/guide-document-client";

const PUBLIC_GUIDE_PATHS = [
  "README.md",
  "APPLICATION_OVERVIEW.md",
  "DATA_FETCHING.md",
  "DASHBOARD_FEATURES.md",
  "STUDENT_CLEAN_AIR_ACTIVITY.md",
  "TEACHER_CLEAN_AIR_LESSON.md",
  "PARENT_AIR_QUALITY_CHECKLIST.md",
  "SCHOOL_AIR_QUALITY_ACTION_GUIDE.md",
  "IMPLEMENTATION_SNAPSHOT.md",
  "CURSOR_SETUP_GUIDE.md",
  "PACKAGE_COMPLETE.md",
  "prompts.md",
  "LANDING_PAGE_GUIDE.md",
  "blockchain-ai/README.md",
  "blockchain-ai/INTEGRATION_GUIDE.md",
] as const;

export const metadata: Metadata = {
  title: "Climate Compass guide",
  description: "A Climate Compass learning resource.",
};

/** Pre-render every public guide shell for static export. */
export function generateStaticParams() {
  const params: { path: string[] }[] = [];
  for (const filepath of PUBLIC_GUIDE_PATHS) {
    const segments = filepath.split("/");
    params.push({ path: segments });
    params.push({ path: ["md", ...segments] });
  }
  return params;
}

export default function GuidePage() {
  return <GuideDocumentClient />;
}
