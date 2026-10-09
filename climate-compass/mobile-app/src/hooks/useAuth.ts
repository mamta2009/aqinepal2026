import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { listMyActionLogs } from "@/services/api/actionLog";
import {
  getAuthProfile,
  getNotificationInbox,
  listSharedContacts,
} from "@/services/api/auth";
import { useAuthStore } from "@/store/authStore";

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "profile"],
    queryFn: getAuthProfile,
    enabled,
    staleTime: 60_000,
  });
}

export function useNotificationInbox(enabled: boolean, limit = 2) {
  return useQuery({
    queryKey: ["auth", "notification-inbox", "preview", limit],
    queryFn: () => getNotificationInbox(limit, 0),
    enabled,
    staleTime: 60_000,
  });
}

const INBOX_PAGE_SIZE = 5;

export function useInfiniteNotificationInbox(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["auth", "notification-inbox", "infinite", INBOX_PAGE_SIZE],
    queryFn: ({ pageParam }) =>
      getNotificationInbox(INBOX_PAGE_SIZE, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      const skip = typeof lastPageParam === "number" ? lastPageParam : 0;
      const fetched = lastPage.entries?.length ?? 0;
      if (fetched < INBOX_PAGE_SIZE) return undefined;
      const total = lastPage.total;
      const nextSkip = skip + fetched;
      if (typeof total === "number" && nextSkip >= total) return undefined;
      return nextSkip;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useSharedContacts(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "shared-contacts"],
    queryFn: listSharedContacts,
    enabled,
    staleTime: 30_000,
  });
}

export function useMyActionLogs(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "action-log"],
    queryFn: () => listMyActionLogs(50),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useIsAuthenticated() {
  return useAuthStore((s) => Boolean(s.accessToken));
}

export function useAuthHydrated() {
  return useAuthStore((s) => s.hydrated);
}

export { INBOX_PAGE_SIZE };
