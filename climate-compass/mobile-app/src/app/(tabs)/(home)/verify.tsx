import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { StackScreen } from "@/components/layout/screen";
import { VerifyForm } from "@/features/auth/VerifyForm";
import { PrimaryButton } from "@/features/auth/FormFields";

export default function VerifyScreen() {
  const router = useRouter();

  return (
    <StackScreen scroll={false}>
      <Stack.Screen options={{ title: "Verify", headerBackTitle: "Back" }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}>
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}>
          <Text className="mb-1 text-2xl font-extrabold text-ink">
            Verify registration
          </Text>
          <Text className="mb-4 text-sm leading-5 text-muted">
            Enter the code sent to your preferred channels, then sign in on the
            Account tab.
          </Text>
          <VerifyForm />
          <View className="mt-4">
            <PrimaryButton
              label="Go to Account to sign in"
              variant="ghost"
              onPress={() => router.replace("/account")}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </StackScreen>
  );
}
