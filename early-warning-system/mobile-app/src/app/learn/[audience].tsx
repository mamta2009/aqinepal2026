import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, SectionTitle } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import {
  audienceGuidePath,
  audiencePages,
  type AudienceKey,
} from "@/content/education";

export default function LearnAudienceScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{ audience?: string }>();
  const key = (params.audience ?? "") as AudienceKey;
  const page = audiencePages[key];
  const guidePath = audienceGuidePath[key];

  useEffect(() => {
    if (page) {
      navigation.setOptions({ title: page.title });
    }
  }, [navigation, page]);

  if (!page) {
    return (
      <SafeAreaView className="flex-1 bg-surface px-4 pt-6">
        <EmptyState
          title="Topic not found"
          message="Choose a learning card from the Learn tab."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Spacing.six,
        }}>
        <View className={`mb-4 rounded-3xl p-5 ${page.accentClass}`}>
          <SectionTitle
            eyebrow={page.eyebrow}
            title={page.title}
            lede={page.lede}
          />
        </View>

        {guidePath ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open linked help guide"
            onPress={() =>
              router.push({
                pathname: "/learn/guide/[path]",
                params: { path: guidePath },
              })
            }
            className="mb-4 min-h-11 items-center justify-center rounded-full bg-forest px-4 py-3 active:opacity-90">
            <Text className="font-extrabold text-white">Open related guide</Text>
          </Pressable>
        ) : null}

        <Text className="mb-3 text-xs font-extrabold uppercase tracking-widest text-forest">
          Three ideas to remember
        </Text>
        {page.facts.map((fact) => (
          <View
            key={fact.title}
            className="mb-3 rounded-2xl border border-border bg-white p-4">
            <Text className="font-extrabold text-ink">{fact.title}</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">{fact.text}</Text>
          </View>
        ))}

        <View className="mt-2 rounded-2xl border border-border bg-white p-4">
          <Text className="text-base font-extrabold text-ink">
            {page.activityTitle}
          </Text>
          {page.activitySteps.map((step, index) => (
            <View key={step} className="mt-3 flex-row gap-3">
              <Text className="font-extrabold text-forest">{index + 1}.</Text>
              <Text className="flex-1 text-sm leading-5 text-muted">{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
