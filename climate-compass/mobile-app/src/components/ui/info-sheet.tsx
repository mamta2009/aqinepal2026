import { type ReactNode, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Mobile equivalent of website DefinitionHelp — tap opens a bottom sheet. */
export function InfoSheet({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`What does ${label} mean?`}
        hitSlop={8}
        onPress={() => setOpen(true)}
        className="h-7 w-7 items-center justify-center rounded-full border border-forest/40 bg-white">
        <Text className="text-sm font-extrabold text-forest">?</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel="Dismiss explanation"
          className="flex-1 justify-end bg-black/40"
          onPress={() => setOpen(false)}>
          <Pressable
            accessibilityRole="summary"
            accessibilityLabel={`${label} definition`}
            onPress={(e) => e.stopPropagation()}
            className="rounded-t-3xl border border-border bg-white px-5 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-border-strong" />
            <Text className="text-lg font-extrabold text-ink">{label}</Text>
            <ScrollView className="mt-2 max-h-72">
              <View className="gap-3">{children}</View>
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => setOpen(false)}
              className="mt-4 min-h-11 items-center justify-center rounded-full bg-forest px-4 py-3">
              <Text className="font-extrabold text-white">Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function InfoSheetParagraph({ children }: { children: ReactNode }) {
  return (
    <Text className="text-base leading-6 text-muted">{children}</Text>
  );
}
