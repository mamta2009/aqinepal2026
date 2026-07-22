import type { ReactNode } from 'react';
import { View, useColorScheme } from 'react-native';
import { BrandColors } from '@/constants/brand';

/** Distinct accent per dashboard feature panel. */
export const DashboardSectionAccent = {
  airQuality: BrandColors.primary,
  forecast: BrandColors.ai,
  alerts: BrandColors.warning,
  cases: BrandColors.secondary,
  scenario: BrandColors.blockchain,
} as const;

/** Distinct accent per account / workspace panel. */
export const AccountSectionAccent = {
  signIn: BrandColors.secondary,
  tip: BrandColors.secondaryLight,
  profile: BrandColors.primary,
  channels: BrandColors.ai,
  inbox: BrandColors.warning,
  facility: BrandColors.success,
  friends: '#0d9488',
  sites: BrandColors.success,
  actionLog: BrandColors.secondary,
  contactForm: BrandColors.ai,
  contactList: BrandColors.secondary,
  sendAlert: BrandColors.primary,
} as const;

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface FeatureSectionProps {
  accent: string;
  children: ReactNode;
}

/**
 * Soft tinted surface + colored outline + top accent bar so each
 * feature panel reads as its own visual block.
 */
export function FeatureSection({ accent, children }: FeatureSectionProps) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View
      className="overflow-hidden rounded-2xl"
      style={{
        borderWidth: 1.5,
        borderColor: withAlpha(accent, isDark ? 0.55 : 0.4),
        backgroundColor: isDark ? withAlpha(accent, 0.1) : withAlpha(accent, 0.05),
        shadowColor: accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.22 : 0.12,
        shadowRadius: 10,
        elevation: 3,
      }}>
      <View style={{ height: 3, backgroundColor: accent }} />
      <View
        className="p-4"
        style={{
          backgroundColor: isDark ? 'rgba(23, 23, 23, 0.92)' : 'rgba(255, 255, 255, 0.94)',
        }}>
        {children}
      </View>
    </View>
  );
}

/** @deprecated Prefer FeatureSection — kept for dashboard import stability. */
export const DashboardSection = FeatureSection;
