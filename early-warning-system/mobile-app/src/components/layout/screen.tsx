import { type ReactElement, type ReactNode } from "react";
import {
  ScrollView,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabInset, ScreenPadding } from "@/constants/theme";

type ScrollExtras = {
  refreshControl?: ReactElement<RefreshControlProps>;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
  showsVerticalScrollIndicator?: boolean;
};

type TabScreenProps = {
  children: ReactNode;
  /** When false, renders a plain flex column (for overlays / nested lists). */
  scroll?: boolean;
  /** Override default horizontal padding (use 0 for edge-bleed children). */
  horizontalPadding?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  className?: string;
} & ScrollExtras;

type StackScreenProps = {
  children: ReactNode;
  /** When false, only applies SafeArea bottom (use with FlatList). */
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  className?: string;
} & ScrollExtras;

/**
 * Tab route shell: top safe area, shared horizontal/top padding,
 * and bottom clearance for the native tab bar.
 */
export function TabScreen({
  children,
  scroll = true,
  horizontalPadding = ScreenPadding.x,
  contentContainerStyle,
  className,
  refreshControl,
  keyboardShouldPersistTaps = "handled",
  showsVerticalScrollIndicator,
}: TabScreenProps) {
  const padding = {
    paddingHorizontal: horizontalPadding,
    paddingTop: ScreenPadding.top,
    paddingBottom: BottomTabInset + ScreenPadding.bottom,
  };

  return (
    <SafeAreaView
      className={className ?? "flex-1 bg-surface"}
      edges={["top"]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          contentContainerStyle={[padding, contentContainerStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1" style={padding}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

/**
 * Stack route shell under a native header: bottom safe area only,
 * shared content padding. Use scroll=false with FlatList parents.
 */
export function StackScreen({
  children,
  scroll = true,
  contentContainerStyle,
  className,
  refreshControl,
  keyboardShouldPersistTaps = "handled",
  showsVerticalScrollIndicator,
}: StackScreenProps) {
  const padding = {
    paddingHorizontal: ScreenPadding.x,
    paddingTop: ScreenPadding.stackTop,
    paddingBottom: ScreenPadding.stackBottom,
  };

  return (
    <SafeAreaView
      className={className ?? "flex-1 bg-surface"}
      edges={["bottom"]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          contentContainerStyle={[padding, contentContainerStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1" style={padding}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

/** Safe-area wrapper for FlatList / custom scroll parents on stack routes. */
export function StackScreenFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SafeAreaView
      className={className ?? "flex-1 bg-surface"}
      edges={["bottom"]}>
      {children}
    </SafeAreaView>
  );
}
