import { Pressable, Text, View } from 'react-native';
import { AccountSectionAccent, FeatureSection } from '@/components/FeatureSection';

type AccountNavTone = 'facility' | 'friends';

interface AccountNavRowProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  /** Distinct accent by destination. */
  tone?: AccountNavTone;
}

const TONE_ACCENT: Record<AccountNavTone, string> = {
  facility: AccountSectionAccent.facility,
  friends: AccountSectionAccent.friends,
};

export function AccountNavRow({
  title,
  subtitle,
  onPress,
  tone = 'facility',
}: AccountNavRowProps) {
  const accent = TONE_ACCENT[tone];

  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-90">
      <FeatureSection accent={accent}>
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-1 rounded-full" style={{ backgroundColor: accent }} />
          <View className="min-w-0 flex-1">
            <Text className="text-base font-semibold text-neutral-900 dark:text-white">
              {title}
            </Text>
            {subtitle ? (
              <Text className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Text className="text-2xl font-light" style={{ color: accent }}>
            ›
          </Text>
        </View>
      </FeatureSection>
    </Pressable>
  );
}
