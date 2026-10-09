import { Text, View } from "react-native";
import { Stack } from "expo-router";
import { StackScreen } from "@/components/layout/screen";
import { AqiHelpChat } from "@/features/aqi-help/AqiHelpChat";

export default function AqiHelpScreen() {
  return (
    <StackScreen scroll={false}>
      <Stack.Screen options={{ title: "aqiHelp", headerBackTitle: "Back" }} />
      <Text className="mb-2 text-xs leading-4 text-muted">
        Plain-language answers from published guides. Not medical or official
        advice.
      </Text>
      <View className="min-h-0 flex-1">
        <AqiHelpChat />
      </View>
    </StackScreen>
  );
}
