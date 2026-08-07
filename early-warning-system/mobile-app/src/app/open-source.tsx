import { Text, View } from "react-native";
import { StackScreen } from "@/components/layout/screen";
import { SectionTitle } from "@/components/ui";

export default function OpenSourceScreen() {
  return (
    <StackScreen>
      <SectionTitle
        eyebrow="License"
        title="Open source"
        lede="Climate Compass is released for public-interest climate awareness and learning."
      />

      <View className="gap-4">
        <View className="rounded-2xl border border-border bg-white p-4">
          <Text className="text-sm font-extrabold text-ink">MIT License</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">
            Open-source MIT License. An educational demonstration for
            public-interest climate awareness.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-white p-4">
          <Text className="text-sm font-extrabold text-ink">Important notice</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">
            Not medical or official emergency advice. Partner support or
            endorsement is stated only when separately published in writing.
          </Text>
        </View>
      </View>
    </StackScreen>
  );
}