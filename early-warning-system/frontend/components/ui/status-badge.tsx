import {
  Check,
  CircleAlert,
  CircleHelp,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type StatusTone = "good" | "moderate" | "sensitive" | "unhealthy" | "unknown";

const styles: Record<StatusTone, string> = {
  good: "border-aq-good/30 bg-green-50 text-aq-good",
  moderate: "border-aq-moderate/30 bg-amber-50 text-aq-moderate",
  sensitive: "border-aq-sensitive/30 bg-orange-50 text-aq-sensitive",
  unhealthy: "border-aq-unhealthy/30 bg-red-50 text-aq-unhealthy",
  unknown: "border-border-strong bg-surface text-muted",
};

const icons = {
  good: Check,
  moderate: CircleAlert,
  sensitive: TriangleAlert,
  unhealthy: TriangleAlert,
  unknown: CircleHelp,
} satisfies Record<StatusTone, typeof Check>;

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icons[tone];
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold",
        styles[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" size={16} />
      {children}
    </span>
  );
}
