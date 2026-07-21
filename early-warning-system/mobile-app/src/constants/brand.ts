/**
 * AQI Nepal brand system, ported from the `:root` CSS variables in
 * `early-warning-system/frontend/index.html` so the mobile dashboard matches
 * the web dashboard. Hex values are exported for places that need raw colors
 * (chart libraries, SVG) — prefer the matching Tailwind classes
 * (`bg-primary`, `text-accent`, …) inside components.
 */
export const BrandColors = {
  primary: "#d32f2f",
  primaryLight: "#ef5350",
  primaryDark: "#b71c1c",
  secondary: "#1565c0",
  secondaryLight: "#1976d2",
  accent: "#ffd600",
  success: "#2e7d32",
  warning: "#f59e0b",
  blockchain: "#7c3aed",
  ai: "#06b6d4",
  surface: "#1a1f26",
  surfaceDark: "#0f1419",
} as const;

export type AlertLevel = "LOW" | "MODERATE" | "HIGH" | "SEVERE" | "NO DATA";

/** Mirrors the tier colors used by `displayAlerts()` / alert cards in `frontend/index.html`. */
export const AlertLevelColors: Record<AlertLevel, string> = {
  LOW: BrandColors.success,
  MODERATE: BrandColors.warning,
  HIGH: BrandColors.primary,
  SEVERE: BrandColors.primaryDark,
  "NO DATA": "#6b7280",
};

/**
 * Left-bar colors for the Heat status card, matching web
 * `#heat-card.heat-hot` / `.heat-mod` (`--high` / `--moderate` / `--low`).
 * MODERATE starts at ~30°C (`HEAT_THRESHOLD_MODERATE_C`).
 */
export const HeatLevelColors: Record<
  "LOW" | "MODERATE" | "HIGH" | "SEVERE",
  string
> = {
  LOW: BrandColors.success,
  MODERATE: "#f57c00",
  HIGH: BrandColors.primary,
  SEVERE: BrandColors.primary,
};
