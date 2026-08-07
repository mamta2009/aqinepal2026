import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, Stack } from 'expo-router';

import { FacilityActionsPanel } from '@/features/account/FacilityActionsPanel';
import {
  useAuthHydrated,
  useIsAuthenticated,
  useProfile,
} from '@/hooks/useAuth';
import { Spacing } from '@/constants/theme';

export default function FacilityActionsScreen() {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useIsAuthenticated();
  const profileQuery = useProfile(isAuthenticated);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await profileQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [profileQuery]);

  if (hydrated && !isAuthenticated) {
    return <Redirect href="/(tabs)/account" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Facility Actions', headerBackTitle: 'Account' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: Spacing.five }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <FacilityActionsPanel profile={profileQuery.data} />
      </ScrollView>
    </SafeAreaView>
  );
}
