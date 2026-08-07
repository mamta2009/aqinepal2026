import { Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StackScreen } from "@/components/layout/screen";
import { VerifyForm } from "@/features/auth/VerifyForm";
import { PrimaryButton } from "@/features/auth/FormFields";

export default function VerifyScreen() {
  const router = useRouter();

  return (
    <StackScreen>
      <Stack.Screen options={{ title: "Verify", headerBackTitle: "Back" }} />
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
    </StackScreen>
  );
}
