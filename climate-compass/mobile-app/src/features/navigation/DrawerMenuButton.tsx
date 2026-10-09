import { Pressable, Text } from "react-native";

import { useDrawerStore } from "@/store/drawerStore";

/** 44pt hamburger that opens the global left navigation drawer. */
export function DrawerMenuButton() {
  const open = useDrawerStore((s) => s.open);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      onPress={open}
      hitSlop={8}
      className="min-h-11 min-w-11 items-center justify-center rounded-2xl border border-border bg-white active:opacity-80">
      <Text className="text-xl font-semibold leading-none text-ink">☰</Text>
    </Pressable>
  );
}
