"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, AdminApiError } from "@/lib/api/admin";
import { queryKeys } from "@/lib/api/query-keys";

export function useAdminSession() {
  const queryClient = useQueryClient();
  const [expired, setExpired] = useState(false);
  const session = useQuery({
    queryKey: queryKeys.adminStatus,
    queryFn: adminApi.probeSession,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    const expire = () => setExpired(true);
    window.addEventListener("admin-session-expired", expire);
    return () => window.removeEventListener("admin-session-expired", expire);
  }, [queryClient]);

  const unlock = useMutation({
    mutationFn: adminApi.unlock,
    onSuccess: async () => {
      setExpired(false);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const logout = useMutation({
    mutationFn: adminApi.logout,
    onSuccess: () => {
      setExpired(true);
      queryClient.removeQueries({ queryKey: ["admin"] });
    },
  });

  return {
    isProbing: session.isPending,
    isAuthenticated: session.isSuccess && !expired,
    probeError:
      session.error instanceof AdminApiError ? session.error : undefined,
    unlock,
    logout,
  };
}
