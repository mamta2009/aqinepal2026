import "@/global.css";
import { Platform } from "react-native";
import { BrandColors } from "@/constants/brand";

/** Forced light palette — system dark mode is not used. */
export const Colors = {
  light: {
    text: BrandColors.ink,
    background: BrandColors.surface,
    backgroundElement: "#ffffff",
    backgroundSelected: BrandColors.skySoft,
    textSecondary: BrandColors.muted,
  },
  dark: {
    text: BrandColors.ink,
    background: BrandColors.surface,
    backgroundElement: "#ffffff",
    backgroundSelected: BrandColors.skySoft,
    textSecondary: BrandColors.muted,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Shared outer padding for tab and stack content shells. */
export const ScreenPadding = {
  x: Spacing.three,
  top: 20,
  /** Extra space above the tab bar inside scroll content. */
  bottom: Spacing.four,
  /** Top padding under a native stack header. */
  stackTop: Spacing.three,
  /** Bottom padding on stack screens. */
  stackBottom: Spacing.five,
} as const;

/**
 * Scroll clearance for the native tab bar + home indicator.
 * Tuned slightly tighter than the previous Android 80 guess.
 */
export const BottomTabInset = Platform.select({ ios: 49, android: 72 }) ?? 0;

export const MaxContentWidth = 800;
