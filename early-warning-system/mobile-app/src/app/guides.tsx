import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { SectionTitle } from "@/components/ui";
import { BrandColors } from "@/constants/brand";
import { Spacing } from "@/constants/theme";
import { educationalGuidePaths } from "@/content/education";
import { useGuides } from "@/hooks/useGuides";

/** Guides hub: published markdown resources only (website `/guides`). */
export default function GuidesScreen() {
  const router = useRouter();
  const guidesQuery = useGuides();

  const learningGuides = useMemo(() => {
    const educational = new Set<string>(educationalGuidePaths);
    const fromApi = (guidesQuery.data ?? []).filter((guide) =>
      educational.has(guide.path),
    );
    if (fromApi.length) return fromApi;
    return educationalGuidePaths.map((path) => ({
      path,
      slug: path.replace(/\.md$/i, ""),
      title: path.replace(/\.md$/i, "").replaceAll("_", " "),
      summary: "Open this practical Climate Compass resource.",
      audience: "Learning resource",
    }));
  }, [guidesQuery.data]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["bottom"]}>
      <Stack.Screen options={{ title: "Guides", headerBackTitle: "Back" }} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Spacing.six,
        }}>
        <SectionTitle
          eyebrow="Learning resources"
          title="Learning resources and guides"
          lede="Clean-air activities and practical guides for Climate Compass students, teachers, parents, and schools."
        />

        <Text className="mb-3 text-xs font-extrabold uppercase tracking-widest text-forest">
          Climate Compass resources
        </Text>

        {guidesQuery.isLoading ? (
          <ActivityIndicator
            className="my-8 self-center"
            color={BrandColors.forest}
          />
        ) : null}

        {learningGuides.map((guide) => (
          <Pressable
            key={guide.path}
            accessibilityRole="button"
            accessibilityLabel={`Open guide ${guide.title}`}
            onPress={() =>
              router.push({
                pathname: "/learn/guide/[path]",
                params: { path: guide.path },
              })
            }
            className="mb-3 rounded-2xl border border-border bg-white p-4 active:opacity-80">
            <Text className="text-xs font-extrabold uppercase tracking-widest text-forest">
              {guide.audience || "Learning resource"}
            </Text>
            <Text className="mt-1 text-base font-extrabold text-ink">
              {guide.title}
            </Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              {guide.summary ||
                "Open this practical Climate Compass resource."}
            </Text>
            <Text className="mt-3 text-sm font-extrabold text-link">
              Open resource
            </Text>
          </Pressable>
        ))}

        <View className="mt-2 rounded-2xl border border-border bg-white p-4">
          <Text className="text-sm leading-5 text-muted">
            Informational resources only. They support learning alongside alerts
            and do not replace official guidance or professional advice.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
