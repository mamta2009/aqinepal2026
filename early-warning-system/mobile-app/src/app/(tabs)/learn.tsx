import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EducationalCard, SectionTitle } from "@/components/ui";
import { BottomTabInset, Spacing } from "@/constants/theme";
import {
  airBasicsTips,
  howItWorksSteps,
  learnHubCards,
} from "@/content/education";

export default function LearnScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: BottomTabInset + Spacing.four,
          paddingTop: 8,
        }}>
        <SectionTitle
          eyebrow="Learning centre"
          title="Explore climate learning with Climate Compass"
          lede="Practical guides for using Climate Compass and understanding air, heat, and outdoor conditions at school and at home."
        />

        <View className="mb-6 rounded-2xl bg-sky-soft p-4">
          <Text className="text-base font-extrabold text-ink">
            Why climate conditions matter
          </Text>
          {airBasicsTips.map((tip) => (
            <View key={tip.title} className="mt-3">
              <Text className="text-sm font-extrabold text-forest">
                {tip.title}
              </Text>
              <Text className="mt-1 text-sm leading-5 text-muted">{tip.text}</Text>
            </View>
          ))}
        </View>

        <Text className="mb-3 text-xs font-extrabold uppercase tracking-widest text-forest">
          Who is this for?
        </Text>
        {learnHubCards.map((card) => (
          <EducationalCard
            key={card.key}
            audience={card.audience}
            title={card.title}
            description={card.description}
            onPress={() =>
              router.push({
                pathname: "/learn/[audience]",
                params: { audience: card.key },
              })
            }
          />
        ))}

        <View className="mt-4 mb-2">
          <SectionTitle eyebrow="How it works" title="Three simple steps" />
          {howItWorksSteps.map((step, index) => (
            <View
              key={step.title}
              className="mb-3 flex-row gap-3 rounded-2xl border border-border bg-white p-4">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-forest">
                <Text className="font-extrabold text-white">{index + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-extrabold text-ink">{step.title}</Text>
                <Text className="mt-1 text-sm leading-5 text-muted">
                  {step.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
