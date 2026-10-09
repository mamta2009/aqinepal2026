import { QueryClient } from "@tanstack/react-query";

/**
 * ~30 min default staleTime mirrors the web dashboard's auto-refresh cadence
 * (`localStorage.dashboard_auto_refresh` in `frontend/index.html`).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000,
      retry: 1,
    },
  },
});
