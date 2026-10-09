"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { accountApi, AccountApiError } from "@/lib/api/account";
import { queryKeys } from "@/lib/api/query-keys";

export const accountKeys = {
  profile: queryKeys.accountProfile,
  contacts: queryKeys.accountContacts,
  notifications: (page: number) => [...queryKeys.accountInbox, page] as const,
  actions: queryKeys.accountActions,
  /** UI session gate — kept after logout so profile is not auto-refetched. */
  sessionUi: ["account", "session-ui"] as const,
};

type SessionUi = { forceSignedOut: boolean };

const signedOutError = () => new AccountApiError("Sign in required", 401);

function useSessionUi() {
  return useQuery({
    queryKey: accountKeys.sessionUi,
    queryFn: (): SessionUi => ({ forceSignedOut: false }),
    staleTime: Infinity,
    gcTime: Infinity,
    initialData: { forceSignedOut: false },
  });
}

export function markAccountSessionActive(queryClient: QueryClient) {
  queryClient.setQueryData<SessionUi>(accountKeys.sessionUi, {
    forceSignedOut: false,
  });
}

/** Drop registrant caches and block profile auto-refetch until the next sign-in. */
export function clearAccountSession(queryClient: QueryClient) {
  queryClient.setQueryData<SessionUi>(accountKeys.sessionUi, {
    forceSignedOut: true,
  });
  void queryClient.cancelQueries({ queryKey: ["account"] });
  queryClient.removeQueries({
    queryKey: ["account"],
    predicate: (query) => query.queryKey[1] !== "session-ui",
  });
}

export function useAccountProfile() {
  const session = useSessionUi();
  const forceSignedOut = session.data?.forceSignedOut === true;

  const query = useQuery({
    queryKey: accountKeys.profile,
    queryFn: accountApi.profile,
    enabled: !forceSignedOut,
    retry: (count, error) =>
      !(error instanceof AccountApiError && error.status === 401) && count < 1,
  });

  if (forceSignedOut) {
    return {
      ...query,
      data: undefined,
      error: signedOutError(),
      isError: true,
      isPending: false,
      isLoading: false,
      isFetching: false,
      isSuccess: false,
      status: "error" as const,
      fetchStatus: "idle" as const,
    };
  }

  const unauthorized =
    query.error instanceof AccountApiError && query.error.status === 401;
  if (unauthorized) {
    return { ...query, data: undefined };
  }
  return query;
}

export function useAccountContacts(enabled: boolean) {
  const session = useSessionUi();
  const forceSignedOut = session.data?.forceSignedOut === true;
  return useQuery({
    queryKey: accountKeys.contacts,
    queryFn: accountApi.contacts,
    enabled: enabled && !forceSignedOut,
  });
}

export function useAccountNotifications(page: number, enabled: boolean) {
  const session = useSessionUi();
  const forceSignedOut = session.data?.forceSignedOut === true;
  return useQuery({
    queryKey: accountKeys.notifications(page),
    queryFn: () => accountApi.notifications(10, page * 10),
    enabled: enabled && !forceSignedOut,
    placeholderData: (previous) => previous,
  });
}

export function useAccountActions(enabled: boolean) {
  const session = useSessionUi();
  const forceSignedOut = session.data?.forceSignedOut === true;
  return useQuery({
    queryKey: accountKeys.actions,
    queryFn: accountApi.actionLogs,
    enabled: enabled && !forceSignedOut,
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
