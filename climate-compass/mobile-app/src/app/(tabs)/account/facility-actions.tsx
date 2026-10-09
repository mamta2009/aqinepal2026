import { useCallback, useState } from "react";
import { RefreshControl } from "react-native";
import { Redirect, Stack } from "expo-router";
import { StackScreen } from "@/components/layout/screen";
import { FacilityActionsPanel } from "@/features/account/FacilityActionsPanel";
import {
  useAuthHydrated,
  useIsAuthenticated,
  useProfile,
} from "@/hooks/useAuth";

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
    return <Redirect href="/account" />;
  }

  return (
    <StackScreen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <Stack.Screen
        options={{ title: "Facilities", headerBackTitle: "Account" }}
      />
      <FacilityActionsPanel profile={profileQuery.data} />
    </StackScreen>
  );
}
