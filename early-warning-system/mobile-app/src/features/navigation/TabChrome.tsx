import { Text, View } from "react-native";

import { DrawerMenuButton } from "@/features/navigation/DrawerMenuButton";

/** Compact top chrome for tab screens that are not the branded Home header. */
export function TabChrome({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="mb-4 flex-row items-center gap-3">
      <DrawerMenuButton />
      <View className="min-w-0 flex-1">
        <Text className="text-xl font-extrabold tracking-tight text-ink">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted">{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}
