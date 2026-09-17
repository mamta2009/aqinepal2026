import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { StackScreen } from "@/components/layout/screen";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { PrimaryButton } from "@/features/auth/FormFields";

export default function RegisterScreen() {
  const router = useRouter();

  return (
    <StackScreen scroll={false}>
      <Stack.Screen options={{ title: "Register", headerBackTitle: "Back" }} />
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
          <Text className="text-xs font-extrabold uppercase tracking-widest text-forest">
            Optional public registration
          </Text>
          <Text className="mt-1 text-3xl font-extrabold tracking-tight text-ink">
            Get air and heat alerts
          </Text>
          <Text className="mt-3 text-base leading-6 text-muted">
            Choose the municipalities and contact channels that matter to you.
            After you submit, enter the code from your email on the Verify screen.
            You can still use the{" "}
            <Text
              className="font-bold text-link underline"
              onPress={() => router.push("/")}>
              Home dashboard
            </Text>{" "}
            without registering.
          </Text>

          <View className="mt-6">
            <RegisterForm />
          </View>

          <View className="mt-4">
            <PrimaryButton
              label="Already registered? Verify code"
              variant="ghost"
              onPress={() => router.push("/verify")}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </StackScreen>
  );
}
