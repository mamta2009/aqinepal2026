import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { StackScreen } from "@/components/layout/screen";
import { GuideMarkdown } from "@/components/guides/guide-markdown";
import { EmptyState } from "@/components/ui";
import { BrandColors } from "@/constants/brand";
import { useGuide } from "@/hooks/useGuides";
import { toApiError } from "@/services/api/client";

export default function GuideDetailScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ path?: string | string[] }>();
  const path = Array.isArray(params.path)
    ? params.path.join("/")
    : params.path;
  const guide = useGuide(path);

  useEffect(() => {
    if (guide.data?.title) {
      navigation.setOptions({ title: guide.data.title });
    }
  }, [guide.data?.title, navigation]);

  if (!path) {
    return (
      <StackScreen>
        <EmptyState
          title="Guide not found"
          message="Choose a guide from the Learn tab."
        />
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      {guide.isLoading ? (
        <ActivityIndicator
          className="mt-10 self-center"
          color={BrandColors.forest}
        />
      ) : guide.isError ? (
        <Text className="text-sm text-alert-red">
          Could not load guide: {toApiError(guide.error).message}
        </Text>
      ) : guide.data?.markdown ? (
        <>
          {guide.data.audience ? (
            <Text className="mb-2 text-xs font-extrabold uppercase tracking-widest text-forest">
              {guide.data.audience}
            </Text>
          ) : null}
          <GuideMarkdown source={guide.data.markdown} />
          <View className="mt-6 rounded-2xl border border-border bg-white p-4">
            <Text className="text-sm leading-5 text-muted">
              Informational resource only. These guides support learning
              alongside alerts and do not replace official guidance or
              professional advice.
            </Text>
          </View>
        </>
      ) : (
        <EmptyState
          title="Guide unavailable"
          message="This guide could not be displayed."
        />
      )}
    </StackScreen>
  );
}
