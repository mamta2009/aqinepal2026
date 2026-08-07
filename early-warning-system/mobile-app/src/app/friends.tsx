import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack } from 'expo-router';

import { FriendsFamilyPanel } from '@/features/account/FriendsFamilyPanel';
import { useAuthHydrated, useIsAuthenticated } from '@/hooks/useAuth';
import { Spacing } from '@/constants/theme';

export default function FriendsScreen() {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useIsAuthenticated();

  if (hydrated && !isAuthenticated) {
    return <Redirect href="/(tabs)/account" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Trusted contacts', headerBackTitle: 'Account' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: Spacing.five }}
        keyboardShouldPersistTaps="handled">
        <FriendsFamilyPanel />
      </ScrollView>
    </SafeAreaView>
  );
}
