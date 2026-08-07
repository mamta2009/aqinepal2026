import { openBrowserAsync, WebBrowserPresentationStyle } from "expo-web-browser";
import { Stack } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StackScreen } from "@/components/layout/screen";
import { SectionTitle } from "@/components/ui";
import { API_BASE_URL } from "@/constants/api";
import { BrandColors } from "@/constants/brand";

export default function AboutScreen() {
  const openPrivacyPolicy = () => {
    void openBrowserAsync(`${API_BASE_URL}/privacy-policy`, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  };

  return (
    <StackScreen>
      <Stack.Screen options={{ title: "About", headerBackTitle: "Back" }} />
      <SectionTitle
        eyebrow="About Climate Compass"
        title="Environmental information people can use"
        lede="Climate Compass is an open-source demonstration that helps people check local air, heat, and rain and get notified when conditions need attention."
      />

      <View className="gap-4">
        <View className="rounded-2xl border border-border bg-white p-4">
          <Text className="text-sm font-extrabold text-ink">What it is</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">
            A public-interest climate solution combining environmental data with
            clear status guidance, alert registration, and optional learning
            resources.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-white p-4">
          <Text className="text-sm font-extrabold text-ink">What it is not</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">
            Not medical advice, an emergency service, or an official government
            forecast. Partner support or endorsement is stated only when
            separately published in writing.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-white p-4">
          <Text className="text-sm font-extrabold text-ink">Open source</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">
            Released under the MIT License for public-interest climate awareness
            and learning. The product can be inspected, adapted, and improved by
            its community.
          </Text>
        </View>

        <Pressable
          accessibilityRole="link"
          onPress={openPrivacyPolicy}
          className="rounded-2xl border border-border bg-white p-4 active:opacity-85">
          <Text className="text-sm font-extrabold text-ink">Privacy Policy</Text>
          <Text className="mt-2 text-sm leading-5" style={{ color: BrandColors.forest }}>
            Read how we handle personal information →
          </Text>
        </Pressable>
      </View>
    </StackScreen>
  );
}
