import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { VerifyForm } from '@/features/auth/VerifyForm';
import { PrimaryButton } from '@/features/auth/FormFields';

export default function VerifyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Verify', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="mb-1 text-2xl font-bold text-neutral-900 dark:text-white">
          Verify registration
        </Text>
        <Text className="mb-4 text-sm text-neutral-500">
          Enter the code sent to your preferred channels, then sign in on the Account tab.
        </Text>
        <VerifyForm />
        <View className="mt-4">
          <PrimaryButton
            label="Go to Account to sign in"
            variant="ghost"
            onPress={() => router.replace('/account')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
