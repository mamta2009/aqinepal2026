import { apiClient } from "./client";

import type {
  AuthProfile,
  FacilityLoginResponse,
  FacilityTokenResponse,
  LoginResponse,
  NotificationInboxResponse,
  PreferencesPatch,
  PreferencesPatchResponse,
} from "@/types/auth";

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/api/auth/login", {
    email,
    password,
  });
  return data;
}

export async function requestFacilityOtp(
  email: string,
): Promise<FacilityLoginResponse> {
  const { data } = await apiClient.post<FacilityLoginResponse>(
    "/api/auth/facility-login",
    {
      email,
    },
  );
  return data;
}

export async function exchangeFacilityOtp(
  email: string,
  code: string,
): Promise<FacilityTokenResponse> {
  const { data } = await apiClient.post<FacilityTokenResponse>(
    "/api/auth/facility-token",
    {
      email,
      code,
    },
  );
  return data;
}

export async function getAuthProfile(): Promise<AuthProfile> {
  const { data } = await apiClient.get<AuthProfile>("/api/auth/profile");
  return data;
}

export async function patchPreferences(
  body: PreferencesPatch,
): Promise<PreferencesPatchResponse> {
  const { data } = await apiClient.patch<PreferencesPatchResponse>(
    "/api/auth/preferences",
    body,
  );
  return data;
}

export async function getNotificationInbox(
  limit = 80,
): Promise<NotificationInboxResponse> {
  const { data } = await apiClient.get<NotificationInboxResponse>(
    "/api/auth/notification-inbox",
    { params: { limit } },
  );
  return data;
}
