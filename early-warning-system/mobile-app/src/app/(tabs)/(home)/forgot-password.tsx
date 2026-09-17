import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from "react-native";
import { Stack } from "expo-router";
import { StackScreen } from "@/components/layout/screen";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

export default function ForgotPasswordScreen() {
  return (
    <StackScreen scroll={false}>
      <Stack.Screen
        options={{ title: "Forgot password", headerBackTitle: "Back" }}
      />
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
            Account recovery
          </Text>
          <Text className="mt-1 text-3xl font-extrabold tracking-tight text-ink">
            Reset your password
          </Text>
          <Text className="mt-3 mb-6 text-base leading-6 text-muted">
            Enter your registered email. We send a one-time code to that inbox
            only, then you can choose a new password.
          </Text>
          <ForgotPasswordForm />
        </ScrollView>
      </KeyboardAvoidingView>
    </StackScreen>
  );
}
