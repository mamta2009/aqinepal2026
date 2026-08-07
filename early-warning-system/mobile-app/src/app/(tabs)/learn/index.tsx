import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { TabScreen } from "@/components/layout/screen";
import { EducationalCard, SectionTitle } from "@/components/ui";
import { BrandColors } from "@/constants/brand";
import {
  airBasicsTips,
  colourGuideStatuses,
  howItWorksSteps,
  learnHubCards,
  measurementTerms,
} from "@/content/education";
import { TabChrome } from "@/features/navigation/TabChrome";

const COLOUR_STYLES: Record<string, { bg: string; text: string }> = {
  Good: { bg: "rgba(22, 163, 74, 0.12)", text: BrandColors.aqGood },
  Moderate: { bg: "rgba(202, 138, 4, 0.14)", text: BrandColors.aqModerate },
  "Use extra care": {
    bg: "rgba(234, 88, 12, 0.12)",
    text: BrandColors.aqSensitive,
  },
  Unhealthy: { bg: "rgba(220, 38, 38, 0.12)", text: BrandColors.aqUnhealthy },
};

/** Learn tab: education hub — glossary, colour guide, audiences, how-it-works. */
export default function LearnScreen() {
  const router = useRouter();

  return (
    <TabScreen>
      <TabChrome title="Learn" subtitle="Learning centre" />
      <SectionTitle
        eyebrow="Learning centre"
        title="Understand outdoor conditions"
        lede="Plain-language tips for air, heat, and rain, plus pathways for students, families, schools, and partners."
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

      <SectionTitle
        eyebrow="Climate conditions made simple"
        title="What are we measuring?"
        lede="Air and heat can affect outdoor activity even when the sky looks fine. These readings help explain local conditions in plain language."
      />
      <View className="mb-6 gap-3">
        {measurementTerms.map((item) => (
          <View
            key={item.term}
            className="rounded-2xl border border-border bg-white p-4">
            <Text className="text-lg font-extrabold text-ink">{item.term}</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              {item.explanation}
            </Text>
          </View>
        ))}
      </View>

      <View className="mb-6 rounded-3xl bg-ink p-5">
        <Text className="text-xs font-extrabold uppercase tracking-widest text-sky-soft">
          A quick colour guide
        </Text>
        <Text className="mt-2 text-2xl font-extrabold text-white">
          Read the meaning, not only the colour
        </Text>
        <View className="mt-4 gap-3">
          {colourGuideStatuses.map((status) => {
            const style = COLOUR_STYLES[status.title] ?? {
              bg: "rgba(255,255,255,0.12)",
              text: BrandColors.ink,
            };
            return (
              <View
                key={status.title}
                className="flex-row items-center gap-3 rounded-2xl bg-white p-4">
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: style.bg }}>
                  <Text
                    className="text-xs font-extrabold"
                    style={{ color: style.text }}>
                    {status.title.slice(0, 1)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-extrabold text-ink">{status.title}</Text>
                  <Text className="mt-0.5 text-sm text-muted">{status.text}</Text>
                </View>
              </View>
            );
          })}
        </View>
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

      <View className="mt-4 mb-4 rounded-2xl border border-border bg-white p-4">
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Optional guides
        </Text>
        <Text className="mt-1 text-base font-extrabold text-ink">
          Published help guides
        </Text>
        <Text className="mt-1 text-sm leading-5 text-muted">
          Short informational resources for families, facilities, and
          classrooms live in the Guides library.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse guides"
          onPress={() => router.push("/guides")}
          className="mt-4 min-h-11 items-center justify-center rounded-full bg-forest px-4 py-3 active:opacity-90">
          <Text className="font-extrabold text-white">Browse guides</Text>
        </Pressable>
      </View>

      <View className="mb-2">
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
    </TabScreen>
  );
}
