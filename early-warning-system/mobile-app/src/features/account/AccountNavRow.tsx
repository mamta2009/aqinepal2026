import { Pressable, Text, View } from 'react-native';

type AccountNavTone = 'facility' | 'friends';

interface AccountNavRowProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  /** Distinct filled colors by destination (not danger/red). */
  tone?: AccountNavTone;
}

const TONE_STYLES: Record<
  AccountNavTone,
  { button: string; title: string }
> = {
  // Workplace / preparedness — green
  facility: {
    button: 'rounded-xl bg-success px-4 py-3.5 active:opacity-90',
    title: 'text-center text-base font-semibold text-white',
  },
  // Alerts to people — teal (ai brand token)
  friends: {
    button: 'rounded-xl bg-ai px-4 py-3.5 active:opacity-90',
    title: 'text-center text-base font-semibold text-white',
  },
};

export function AccountNavRow({
  title,
  subtitle,
  onPress,
  tone = 'facility',
}: AccountNavRowProps) {
  const styles = TONE_STYLES[tone];

  return (
    <View>
      <Pressable
        onPress={onPress}
        className={styles.button}
        accessibilityRole="button">
        <View className="flex-row items-center justify-between px-1">
          <Text className={`flex-1 ${styles.title}`}>{title}</Text>
          <Text className={styles.title}>›</Text>
        </View>
      </Pressable>
      {subtitle ? (
        <Text className="mt-1.5 px-1 text-center text-xs leading-4 text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
