import { useQuery } from "@tanstack/react-query";

import { getAuthProfile, getNotificationInbox } from "@/services/api/auth";
import { useAuthStore } from "@/store/authStore";

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "profile"],
    queryFn: getAuthProfile,
    enabled,
    staleTime: 60_000,
  });
}

export function useNotificationInbox(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "notification-inbox"],
    queryFn: () => getNotificationInbox(80),
    enabled,
    staleTime: 60_000,
  });
}

export function useIsAuthenticated() {
  return useAuthStore((s) => Boolean(s.accessToken));
}

export function useAuthHydrated() {
  return useAuthStore((s) => s.hydrated);
}
