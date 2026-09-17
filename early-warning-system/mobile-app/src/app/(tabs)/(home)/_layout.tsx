import { Stack } from "expo-router";
import { BrandColors } from "@/constants/brand";

export const unstable_settings = {
  initialRouteName: "index",
};

const screenOptions = {
  headerStyle: { backgroundColor: BrandColors.surface },
  headerTintColor: BrandColors.forest,
  headerTitleStyle: { fontWeight: "700" as const, color: BrandColors.ink },
  contentStyle: { backgroundColor: BrandColors.surface },
};

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ title: "About" }} />
      <Stack.Screen name="aqi-help" options={{ title: "aqiHelp" }} />
      <Stack.Screen name="map" options={{ title: "Map" }} />
      <Stack.Screen name="compare" options={{ title: "Compare cities" }} />
      <Stack.Screen name="alerts" options={{ title: "Recent Alerts" }} />
      <Stack.Screen name="register" options={{ title: "Register" }} />
      <Stack.Screen name="verify" options={{ title: "Verify" }} />
      <Stack.Screen
        name="forgot-password"
        options={{ title: "Forgot password" }}
      />
      <Stack.Screen name="guides" options={{ title: "Guides" }} />
    </Stack>
  );
}
