import {
  CloudDrizzle,
  CloudOff,
  CloudRain,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { RainIndicator } from "@/lib/weather-rain";

const RAIN_ICON: Record<
  RainIndicator["status"],
  { Icon: LucideIcon; className: string; label: string }
> = {
  Raining: {
    Icon: CloudRain,
    className: "size-10 text-link",
    label: "Raining",
  },
  Wet: {
    Icon: CloudDrizzle,
    className: "size-10 text-sky",
    label: "Wet",
  },
  Dry: {
    Icon: Sun,
    className: "size-10 text-aq-moderate",
    label: "Dry",
  },
  Unavailable: {
    Icon: CloudOff,
    className: "size-10 text-muted opacity-70",
    label: "Unavailable",
  },
};

/** Distinct rain-status glyph used on the dashboard Rain chip. */
export function RainStatusIcon({
  status,
}: {
  status: RainIndicator["status"];
}) {
  const { Icon, className, label } = RAIN_ICON[status];
  return (
    <span className="inline-flex items-center" aria-label={label}>
      <Icon className={className} strokeWidth={2.25} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
