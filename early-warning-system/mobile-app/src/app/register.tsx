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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="mb-1 text-2xl font-bold text-neutral-900 dark:text-white">
          Create account
        </Text>
        <Text className="mb-4 text-sm text-neutral-500">
          Same registration fields as the web portal. You will verify a code next.
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
