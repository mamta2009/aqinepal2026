"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { accountApi, AccountApiError } from "@/lib/api/account";
import { queryKeys } from "@/lib/api/query-keys";

export const accountKeys = {
  profile: queryKeys.accountProfile,
  contacts: queryKeys.accountContacts,
  notifications: (page: number) => [...queryKeys.accountInbox, page] as const,
  actions: queryKeys.accountActions,
};

export function useAccountProfile() {
  return useQuery({
    queryKey: accountKeys.profile,
    queryFn: accountApi.profile,
    retry: (count, error) =>
      !(error instanceof AccountApiError && error.status === 401) && count < 1,
  });
}

export function useAccountContacts(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.contacts,
    queryFn: accountApi.contacts,
    enabled,
  });
}

export function useAccountNotifications(page: number, enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.notifications(page),
    queryFn: () => accountApi.notifications(10, page * 10),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useAccountActions(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.actions,
    queryFn: accountApi.actionLogs,
    enabled,
  });
}

export function useAccountMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">,
) {
  return useMutation({ mutationFn, ...options });
}

export function useRefreshAccount() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["account"] });
}

export function useAccountQueryClient() {
  return useQueryClient();
}
