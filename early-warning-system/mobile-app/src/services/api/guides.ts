import { apiClient } from "@/services/api/client";

export type GuideResource = {
  path: string;
  slug: string;
  title: string;
  summary?: string | null;
  audience?: string | null;
};

export type GuideResourceDocument = GuideResource & {
  html: string;
  markdown?: string;
};

export async function listGuides(): Promise<GuideResource[]> {
  const { data } = await apiClient.get<{
    guides?: GuideResource[];
    resources?: GuideResource[];
  }>("/api/guides");
  return data.resources || data.guides || [];
}

export async function getGuide(path: string): Promise<GuideResourceDocument> {
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const { data } = await apiClient.get<GuideResourceDocument>(
    `/api/guides/${encoded}`,
    { params: { include_markdown: true } },
  );
  return data;
}
