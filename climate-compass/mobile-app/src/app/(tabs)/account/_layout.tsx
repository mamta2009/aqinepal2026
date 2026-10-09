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

export default function AccountStackLayout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="inbox" options={{ title: "Notification inbox" }} />
      <Stack.Screen name="facility-actions" options={{ title: "Facilities" }} />
      <Stack.Screen name="friends" options={{ title: "Trusted contacts" }} />
    </Stack>
  );
}
