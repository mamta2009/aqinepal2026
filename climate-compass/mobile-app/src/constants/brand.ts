/**
 * Climate Compass brand system, aligned with the Next.js website tokens in
 * `early-warning-system/frontend/app/globals.css`.
 */
export const BrandColors = {
  forest: "#1f794b",
  forestDark: "#155936",
  leaf: "#54b260",
  sky: "#9ad6f2",
  skySoft: "#e8f7fd",
  alertRed: "#c02e2f",
  surface: "#f8fcfd",
  surfaceTint: "#eef8f2",
  ink: "#173244",
  inkSoft: "#334f5d",
  muted: "#526b78",
  border: "#d8e5e9",
  borderStrong: "#b9ced5",
  link: "#176b8c",
  aqGood: "#287a47",
  aqModerate: "#b8860b",
  aqSensitive: "#c2410c",
  aqUnhealthy: "#a92327",
  /** Legacy aliases used by older chart / accent code. */
  primary: "#1f794b",
  primaryLight: "#54b260",
  primaryDark: "#155936",
  secondary: "#176b8c",
  secondaryLight: "#9ad6f2",
  accent: "#54b260",
  success: "#287a47",
  warning: "#b8860b",
  blockchain: "#176b8c",
  ai: "#176b8c",
  surfaceDark: "#f8fcfd",
} as const;

export type AlertLevel = "LOW" | "MODERATE" | "HIGH" | "SEVERE" | "NO DATA";

export const AlertLevelColors: Record<AlertLevel, string> = {
  LOW: BrandColors.aqGood,
  MODERATE: BrandColors.aqModerate,
  HIGH: BrandColors.aqSensitive,
  SEVERE: BrandColors.aqUnhealthy,
  "NO DATA": BrandColors.muted,
};

export const HeatLevelColors: Record<
  "LOW" | "MODERATE" | "HIGH" | "SEVERE",
  string
> = {
  LOW: BrandColors.aqGood,
  MODERATE: BrandColors.aqModerate,
  HIGH: BrandColors.aqSensitive,
  SEVERE: BrandColors.aqUnhealthy,
};

export const AirBandColors = {
  good: BrandColors.aqGood,
  moderate: BrandColors.aqModerate,
  sensitive: BrandColors.aqSensitive,
  unhealthy: BrandColors.aqUnhealthy,
  "no-data": BrandColors.muted,
} as const;
