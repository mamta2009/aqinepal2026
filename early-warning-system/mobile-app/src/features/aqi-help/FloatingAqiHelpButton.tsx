import { usePathname, useRouter, useSegments } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandColors } from "@/constants/brand";
import { useDrawerStore } from "@/store/drawerStore";

/** Native tab bar height above the home-indicator / gesture inset. */
const TAB_BAR_HEIGHT = Platform.select({ ios: 56, android: 64 }) ?? 56;
const FAB_GAP = 12;

/** Floating aqiHelp entry point, above the tab bar (bottom-right). */
export function FloatingAqiHelpButton() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const drawerOpen = useDrawerStore((s) => s.isOpen);

  const onAqiHelp =
    pathname === "/aqi-help" || pathname.startsWith("/aqi-help/");
  const inTabs =
    segments[0] === "(tabs)" ||
    pathname === "/" ||
    pathname === "/learn" ||
    pathname === "/account";

  if (onAqiHelp || drawerOpen) {
    return null;
  }

  // Tab bar sits above the bottom safe area (home indicator / nav gestures).
  const bottom = inTabs
    ? insets.bottom + TAB_BAR_HEIGHT + FAB_GAP
    : Math.max(insets.bottom, 12) + FAB_GAP;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        right: 16,
        bottom,
        zIndex: 40,
        elevation: 10,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask aqiHelp"
        onPress={() => router.push("/aqi-help")}
        className="h-14 w-14 items-center justify-center rounded-full active:opacity-90"
        style={{
          backgroundColor: BrandColors.forest,
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}>
        <Text className="text-xl font-extrabold text-white">?</Text>
      </Pressable>
    </View>
  );
}
