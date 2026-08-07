import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { SectionTitle } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { EnvironmentOverviewPanel } from "@/features/maps/EnvironmentOverviewPanel";

export default function MapScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["bottom"]}>
      <Stack.Screen options={{ title: "Map", headerBackTitle: "Back" }} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Spacing.six,
        }}>
        <SectionTitle
          eyebrow="National conditions"
          title="Air and heat across Nepal"
          lede="A schematic map and complete data table for major cities. This view uses the backend environmental overview and never treats color as the only status signal."
        />
        <View className="mt-2">
          <EnvironmentOverviewPanel />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
