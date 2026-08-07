import type { ReactNode } from "react";
import { View } from "react-native";

import { BrandColors } from "@/constants/brand";

export const DashboardSectionAccent = {
  airQuality: BrandColors.forest,
  forecast: BrandColors.link,
  alerts: BrandColors.aqModerate,
  cases: BrandColors.link,
  scenario: BrandColors.leaf,
} as const;

export const AccountSectionAccent = {
  signIn: BrandColors.link,
  tip: BrandColors.sky,
  profile: BrandColors.forest,
  channels: BrandColors.link,
  inbox: BrandColors.aqModerate,
  facility: BrandColors.leaf,
  friends: BrandColors.link,
  sites: BrandColors.leaf,
  actionLog: BrandColors.link,
  contactForm: BrandColors.link,
  contactList: BrandColors.forest,
  sendAlert: BrandColors.alertRed,
} as const;

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface FeatureSectionProps {
  accent: string;
  children: ReactNode;
}

export function FeatureSection({ accent, children }: FeatureSectionProps) {
  return (
    <View
      className="overflow-hidden rounded-2xl bg-white"
      style={{
        borderWidth: 1,
        borderColor: BrandColors.border,
        shadowColor: BrandColors.ink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
      }}>
      <View style={{ height: 3, backgroundColor: accent }} />
      <View
        className="p-4"
        style={{ backgroundColor: withAlpha(accent, 0.04) }}>
        {children}
      </View>
    </View>
  );
}

/** @deprecated Prefer FeatureSection — kept for dashboard import stability. */
export const DashboardSection = FeatureSection;
