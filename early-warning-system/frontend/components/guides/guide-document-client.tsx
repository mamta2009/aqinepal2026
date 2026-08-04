"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TrustedGuideHtml } from "@/components/guides/trusted-guide-html";
import { api } from "@/lib/api/endpoints";

function sanitizeGuidePath(input: string[]) {
  const segments = input[0]?.toLowerCase() === "md" ? input.slice(1) : input;
  if (
    !segments.length ||
    segments.length > 6 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.length > 120 ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment),
    ) ||
    !segments.at(-1)?.toLowerCase().endsWith(".md")
  ) {
    return null;
  }
  return segments.join("/");
}

export function GuideDocumentClient() {
  const params = useParams<{ path: string[] }>();
  const route = sanitizeGuidePath(
    Array.isArray(params.path) ? params.path : [],
  );

  const query = useQuery({
    queryKey: ["guides", "document", route],
    queryFn: () => api.guides.get(route!),
    enabled: Boolean(route),
  });

  if (!route) {
    return (
      <div className="page-shell py-16">
        <p className="text-muted">Guide not found.</p>
        <Link href="/guides/" className="mt-4 inline-flex font-extrabold text-link">
          ← Back to guides
        </Link>
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className="page-shell py-16" role="status">
        Loading guide…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="page-shell py-16">
        <p className="text-muted">This guide could not be loaded.</p>
        <Link href="/guides/" className="mt-4 inline-flex font-extrabold text-link">
          ← Back to guides
        </Link>
      </div>
    );
  }

  return (
    <div className="page-shell py-12 sm:py-20">
      <Link
        href="/guides/"
        className="inline-flex min-h-11 items-center font-extrabold text-link hover:text-forest-dark"
      >
        ← Back to guides
      </Link>
      <article className="mx-auto mt-5 max-w-4xl rounded-[2rem] border border-border bg-white p-6 shadow-sm sm:p-10">
        <TrustedGuideHtml html={query.data.html} />
      </article>
      <aside className="mx-auto mt-6 max-w-4xl rounded-2xl bg-sky-soft p-5 text-sm leading-6 text-ink-soft">
        <strong className="text-ink">About this resource:</strong> Guide HTML is
        rendered and sanitized by the Climate Compass server. Educational
        guidance does not replace medical advice or official alerts.
      </aside>
    </div>
  );
}
