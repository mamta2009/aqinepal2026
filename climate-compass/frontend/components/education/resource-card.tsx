import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardKicker } from "@/components/ui/card";

export type ResourceCardData = {
  audience: string;
  title: string;
  description: string;
  href: string;
};

export function ResourceCard({
  resource,
}: {
  resource: ResourceCardData;
}) {
  return (
    <Card className="group flex h-full flex-col border-0 bg-white shadow-[0_16px_45px_rgba(23,50,68,0.09)]">
      <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-sky-soft text-link">
        <FileText aria-hidden="true" className="size-6" />
      </div>
      <CardKicker>{resource.audience}</CardKicker>
      <h3 className="text-xl font-bold text-ink">{resource.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-7 text-muted">
        {resource.description}
      </p>
      <Link
        href={resource.href}
        className="mt-5 inline-flex min-h-11 items-center gap-2 font-extrabold text-link hover:text-forest-dark"
      >
        Open resource
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform group-hover:translate-x-1"
        />
      </Link>
    </Card>
  );
}
