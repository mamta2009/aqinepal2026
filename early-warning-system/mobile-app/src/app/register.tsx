import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { RegisterForm } from '@/features/auth/RegisterForm';
import { PrimaryButton } from '@/features/auth/FormFields';

export default function RegisterScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Register', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View className="mb-4 rounded-xl border border-neutral-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="text-sm leading-5 text-neutral-600 dark:text-neutral-300">
            Registration is optional. You can open the dashboard anytime — use Register alerts when you want
            facility-level notifications.
          </Text>
        </View>

        <Text className="mb-1 text-2xl font-bold text-neutral-900 dark:text-white">
          Climate Compass Registration
        </Text>
        <Text className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Join our network and receive real-time air quality alerts for your facility
        </Text>

        <RegisterForm />

        <View className="mt-4">
          <PrimaryButton
            label="Already registered? Verify code"
            variant="ghost"
            onPress={() => router.push('/verify')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
