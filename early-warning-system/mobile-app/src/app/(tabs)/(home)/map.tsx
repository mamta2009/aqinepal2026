import { Text, View } from "react-native";
import { Stack } from "expo-router";
import { StackScreen } from "@/components/layout/screen";
import { SectionTitle } from "@/components/ui";
import { EnvironmentOverviewPanel } from "@/features/maps/EnvironmentOverviewPanel";

export default function MapScreen() {
  return (
    <StackScreen>
      <Stack.Screen options={{ title: "Map", headerBackTitle: "Back" }} />
      <SectionTitle
        eyebrow="National conditions"
        title="Air and heat across Nepal"
        lede="A schematic map and complete data table for major cities. This view uses the backend environmental overview and never treats color as the only status signal."
      />
      <View className="mt-2">
        <EnvironmentOverviewPanel />
      </View>
    </StackScreen>
  );
}
