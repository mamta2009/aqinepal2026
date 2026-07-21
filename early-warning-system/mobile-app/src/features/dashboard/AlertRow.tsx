import { Text, View } from 'react-native';

import { AlertLevelColors } from '@/constants/brand';

interface AlertRowProps {
  level: string;
  time: string;
  message: string;
}

export function AlertRow({ level, time, message }: AlertRowProps) {
  const color =
    AlertLevelColors[level as keyof typeof AlertLevelColors] ??
    (level === 'INFO' ? '#1565c0' : '#6b7280');

  return (
    <View className="flex-row gap-3 border-b border-neutral-100 py-3 dark:border-neutral-800">
      <View className="w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color }}>
            {level}
          </Text>
          <Text className="text-[11px] text-neutral-400 dark:text-neutral-500">{time}</Text>
        </View>
        <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{message}</Text>
      </View>
    </View>
  );
}
