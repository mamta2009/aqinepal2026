import { Image } from "expo-image";
import { type Href, usePathname, useRouter } from "expo-router";
import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE_URL } from "@/constants/api";
import { BrandColors } from "@/constants/brand";
import {
  DRAWER_NAV,
  isDrawerItemActive,
  type DrawerNavItem,
} from "@/features/navigation/drawer-nav";
import { useIsAuthenticated, useProfile } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { useDrawerStore } from "@/store/drawerStore";

const EDGE_WIDTH = 22;
const OPEN_MS = 230;
const CLOSE_MS = 200;

function NavRow({
  item,
  active,
  onPress,
}: {
  item: DrawerNavItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className="mb-1 min-h-11 flex-row items-center gap-3 rounded-2xl px-3 py-2.5 active:opacity-85"
      style={
        active
          ? { backgroundColor: BrandColors.skySoft }
          : { backgroundColor: "transparent" }
      }>
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{
          backgroundColor: active ? BrandColors.forest : BrandColors.surfaceTint,
        }}>
        <Text
          className="text-sm font-bold"
          style={{ color: active ? "#ffffff" : BrandColors.forest }}>
          {item.icon}
        </Text>
      </View>
      <Text
        className="flex-1 text-[15px] font-bold"
        style={{ color: active ? BrandColors.forestDark : BrandColors.ink }}>
        {item.label}
      </Text>
    </Pressable>
  );
}

/** Global MD3-style left navigation drawer with edge swipe. */
export function AppDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const isOpen = useDrawerStore((s) => s.isOpen);
  const open = useDrawerStore((s) => s.open);
  const close = useDrawerStore((s) => s.close);
  const setLastDrawerHref = useDrawerStore((s) => s.setLastDrawerHref);
  const selectedCity = useDashboardStore((s) => s.selectedCity);
  const isAuthenticated = useIsAuthenticated();
  const clearSession = useAuthStore((s) => s.clearSession);
  const profileQuery = useProfile(isAuthenticated);
  const displayName =
    profileQuery.data?.name?.trim() ||
    profileQuery.data?.email?.trim() ||
    "Signed in";

  const navGroups = useMemo(
    () =>
      DRAWER_NAV.map((group) => ({
        ...group,
        items: isAuthenticated
          ? group.items.filter((item) => item.id !== "register")
          : group.items,
      })).filter((group) => group.items.length > 0),
    [isAuthenticated],
  );

  const panelWidth = Math.min(320, Math.round(windowWidth * 0.86));
  const progress = useSharedValue(0);
  const openSV = useSharedValue(0);

  useEffect(() => {
    openSV.value = isOpen ? 1 : 0;
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: isOpen ? OPEN_MS : CLOSE_MS,
    });
  }, [isOpen, openSV, progress]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.45,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * panelWidth }],
  }));

  const openDrawer = () => open();
  const closeDrawer = () => close();

  const edgeGesture = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-24, 24])
    .onUpdate((e) => {
      "worklet";
      if (openSV.value === 1) return;
      const next = Math.min(1, Math.max(0, e.translationX / panelWidth));
      progress.value = next;
    })
    .onEnd((e) => {
      "worklet";
      if (openSV.value === 1) return;
      const shouldOpen =
        e.translationX > panelWidth * 0.28 || e.velocityX > 450;
      if (shouldOpen) {
        progress.value = withTiming(1, { duration: OPEN_MS });
        runOnJS(openDrawer)();
      } else {
        progress.value = withTiming(0, { duration: CLOSE_MS });
      }
    });

  const closeGesture = Gesture.Pan()
    .activeOffsetX(-12)
    .failOffsetY([-24, 24])
    .onUpdate((e) => {
      "worklet";
      if (openSV.value === 0) return;
      const next = Math.min(
        1,
        Math.max(0, 1 + e.translationX / panelWidth),
      );
      progress.value = next;
    })
    .onEnd((e) => {
      "worklet";
      if (openSV.value === 0) return;
      const shouldClose =
        e.translationX < -panelWidth * 0.22 || e.velocityX < -450;
      if (shouldClose) {
        progress.value = withTiming(0, { duration: CLOSE_MS });
        runOnJS(closeDrawer)();
      } else {
        progress.value = withTiming(1, { duration: OPEN_MS });
      }
    });

  const navigateItem = async (item: DrawerNavItem) => {
    close();
    const action = item.action;
    if (action.type === "browser") {
      setLastDrawerHref(action.path);
      await openBrowserAsync(`${API_BASE_URL}${action.path}`, {
        presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      });
      return;
    }
    if (action.type === "alerts") {
      setLastDrawerHref("/alerts");
      router.push({
        pathname: "/alerts",
        params: { city: selectedCity },
      });
      return;
    }
    setLastDrawerHref(action.href);
    if (action.href.startsWith("/learn/") && action.href !== "/learn/guide") {
      const audience = action.href.replace("/learn/", "");
      router.push({
        pathname: "/learn/[audience]",
        params: { audience },
      });
      return;
    }
    router.push(action.href as Href);
  };

  return (
    <>
      {!isOpen ? (
        <GestureDetector gesture={edgeGesture}>
          <View
            pointerEvents="box-only"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: EDGE_WIDTH + insets.left,
              zIndex: 40,
            }}
          />
        </GestureDetector>
      ) : null}

      <View
        pointerEvents={isOpen ? "auto" : "none"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close navigation menu"
          onPress={close}
          style={{ flex: 1 }}>
          <Animated.View
            style={[
              {
                flex: 1,
                backgroundColor: "#000000",
              },
              scrimStyle,
            ]}
          />
        </Pressable>

        <GestureDetector gesture={closeGesture}>
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: panelWidth,
                backgroundColor: BrandColors.surface,
                borderRightWidth: 1,
                borderRightColor: BrandColors.border,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 16,
                shadowOffset: { width: 4, height: 0 },
                elevation: 12,
              },
              panelStyle,
            ]}>
            <View
              style={{
                flex: 1,
                paddingTop: insets.top + 12,
                paddingBottom: insets.bottom + 12,
                paddingLeft: Math.max(insets.left, 16),
                paddingRight: 16,
              }}>
              <View className="mb-4 flex-row items-center gap-3 pr-2">
                <Image
                  source={require("@/assets/images/climate-compass-logo-192.png")}
                  style={{ width: 44, height: 44 }}
                  contentFit="contain"
                  accessibilityLabel="Climate Compass logo"
                />
                <View className="flex-1">
                  <Text className="text-lg font-extrabold tracking-tight text-forest">
                    Climate Compass
                  </Text>
                  <Text className="mt-0.5 text-xs leading-4 text-muted">
                    Climate-health awareness for Nepal
                  </Text>
                </View>
              </View>

              {isAuthenticated ? (
                <View
                  className="mb-3 rounded-2xl px-3 py-3"
                  style={{ backgroundColor: BrandColors.skySoft }}>
                  <Text className="text-[10px] font-extrabold uppercase tracking-widest text-forest">
                    Signed in as
                  </Text>
                  <Text
                    className="mt-1 text-[15px] font-extrabold"
                    style={{ color: BrandColors.forestDark }}
                    numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sign out"
                    onPress={() => {
                      close();
                      void clearSession();
                    }}
                    className="mt-3 min-h-10 items-center justify-center rounded-xl active:opacity-85"
                    style={{ backgroundColor: BrandColors.forest }}>
                    <Text className="text-sm font-bold text-white">Sign out</Text>
                  </Pressable>
                </View>
              ) : null}

              <View
                className="mb-3"
                style={{
                  height: 1,
                  backgroundColor: BrandColors.border,
                }}
              />

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}>
                {navGroups.map((group) => (
                  <View key={group.id} className="mb-3">
                    <Text className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-widest text-forest">
                      {group.title}
                    </Text>
                    {group.items.map((item) => (
                      <NavRow
                        key={item.id}
                        item={item}
                        active={isDrawerItemActive(pathname, item)}
                        onPress={() => {
                          void navigateItem(item);
                        }}
                      />
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </>
  );
}
