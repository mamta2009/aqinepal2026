import { Redirect, Stack } from "expo-router";
import { StackScreen } from "@/components/layout/screen";
import { FriendsFamilyPanel } from "@/features/account/FriendsFamilyPanel";
import { useAuthHydrated, useIsAuthenticated } from "@/hooks/useAuth";

export default function FriendsScreen() {
  const hydrated = useAuthHydrated();
  const isAuthenticated = useIsAuthenticated();

  if (hydrated && !isAuthenticated) {
    return <Redirect href="/(tabs)/account" />;
  }

  return (
    <StackScreen>
      <Stack.Screen
        options={{ title: "Trusted contacts", headerBackTitle: "Account" }}
      />
      <FriendsFamilyPanel />
    </StackScreen>
  );
}
