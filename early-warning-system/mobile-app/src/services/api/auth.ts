import { apiClient } from "./client";

import type {
  AuthProfile,
  FacilityLoginResponse,
  FacilityTokenResponse,
  LoginResponse,
  NotificationInboxResponse,
  PreferencesPatch,
  PreferencesPatchResponse,
  SharedAlertContact,
  SharedContactCreatePayload,
  SharedContactNotifyPayload,
  SharedContactNotifyResponse,
  SharedContactUpdatePayload,
  SharedContactsResponse,
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
  skip = 0,
): Promise<NotificationInboxResponse> {
  const { data } = await apiClient.get<NotificationInboxResponse>(
    "/api/auth/notification-inbox",
    { params: { limit, skip } },
  );
  return data;
}

export async function listSharedContacts(): Promise<SharedContactsResponse> {
  const { data } = await apiClient.get<SharedContactsResponse>(
    "/api/auth/shared-contacts",
  );
  return data;
}

export async function createSharedContact(
  body: SharedContactCreatePayload,
): Promise<{ success: boolean; contact: SharedAlertContact }> {
  const { data } = await apiClient.post<{
    success: boolean;
    contact: SharedAlertContact;
  }>("/api/auth/shared-contacts", body);
  return data;
}

export async function updateSharedContact(
  contactId: string,
  body: SharedContactUpdatePayload,
): Promise<{ success: boolean; contact: SharedAlertContact }> {
  const { data } = await apiClient.patch<{
    success: boolean;
    contact: SharedAlertContact;
  }>(`/api/auth/shared-contacts/${encodeURIComponent(contactId)}`, body);
  return data;
}

export async function deleteSharedContact(
  contactId: string,
): Promise<{ success: boolean; deleted_id: string }> {
  const { data } = await apiClient.delete<{
    success: boolean;
    deleted_id: string;
  }>(`/api/auth/shared-contacts/${encodeURIComponent(contactId)}`);
  return data;
}

export async function notifySharedContacts(
  body: SharedContactNotifyPayload,
): Promise<SharedContactNotifyResponse> {
  const { data } = await apiClient.post<SharedContactNotifyResponse>(
    "/api/auth/shared-contacts/notify",
    body,
  );
  return data;
}

export async function deleteAccount(body: {
  password: string;
  confirm: string;
}): Promise<{
  success: boolean;
  message?: string;
  contact_removed?: boolean;
}> {
  const { data } = await apiClient.post<{
    success: boolean;
    message?: string;
    contact_removed?: boolean;
  }>("/api/auth/delete-account", body);
  return data;
}
