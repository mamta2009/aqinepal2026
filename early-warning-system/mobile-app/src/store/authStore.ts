import { create } from "zustand";

import { setAuthTokenProvider } from "@/services/api/client";
import { queryClient } from "@/services/api/queryClient";
import { sessionDelete, sessionGet, sessionSet } from "@/utils/sessionStorage";

import type { AuthClaimsPreview } from "@/types/auth";

const TOKEN_KEY = "facility_access_token";
const READY_KEY = "ew_facility_reporting_ready";
const CLAIMS_KEY = "facility_claims_preview";

interface AuthSession {
  accessToken: string;
  facilityReportingReady: boolean;
  claims: AuthClaimsPreview | null;
}

interface AuthState {
  accessToken: string | null;
  facilityReportingReady: boolean;
  claims: AuthClaimsPreview | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
  clearSession: () => Promise<void>;
}

async function writeSession(session: AuthSession): Promise<void> {
  await sessionSet(TOKEN_KEY, session.accessToken);
  await sessionSet(READY_KEY, session.facilityReportingReady ? "1" : "0");
  if (session.claims) {
    await sessionSet(CLAIMS_KEY, JSON.stringify(session.claims));
  } else {
    await sessionDelete(CLAIMS_KEY);
  }
}

async function clearStoredSession(): Promise<void> {
  await sessionDelete(TOKEN_KEY);
  await sessionDelete(READY_KEY);
  await sessionDelete(CLAIMS_KEY);
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  facilityReportingReady: false,
  claims: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const [token, ready, claimsRaw] = await Promise.all([
        sessionGet(TOKEN_KEY),
        sessionGet(READY_KEY),
        sessionGet(CLAIMS_KEY),
      ]);
      let claims: AuthClaimsPreview | null = null;
      if (claimsRaw) {
        try {
          claims = JSON.parse(claimsRaw) as AuthClaimsPreview;
        } catch {
          claims = null;
        }
      }
      set({
        accessToken: token,
        facilityReportingReady: ready === "1",
        claims,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setSession: async (session) => {
    await writeSession(session);
    set({
      accessToken: session.accessToken,
      facilityReportingReady: session.facilityReportingReady,
      claims: session.claims,
    });
  },

  clearSession: async () => {
    await clearStoredSession();
    set({
      accessToken: null,
      facilityReportingReady: false,
      claims: null,
    });
    queryClient.removeQueries({ queryKey: ["auth"] });
  },
}));

/** Wire Axios Bearer provider once at module load; reads live store state. */
setAuthTokenProvider(() => useAuthStore.getState().accessToken);

export function isLoggedIn(): boolean {
  return Boolean(useAuthStore.getState().accessToken);
}
