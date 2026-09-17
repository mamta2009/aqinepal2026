import { browserApi } from "./browser";
import { ApiError } from "./error";

export type Channel = "sms" | "email" | "whatsapp";

export interface AccountProfile {
  _id: string;
  name?: string;
  email: string;
  phone_number?: string;
  whatsapp_number?: string;
  contact_type?: string;
  city?: string;
  cities?: string[];
  facility_name?: string;
  facility_names?: string[];
  facility_id?: string;
  facility_reporting_ready?: boolean;
  facility_site_pm25_thresholds?: Record<string, number>;
  school_contact?: string | null;
  school_address?: string | null;
  school_information?: string | null;
  preferred_channels?: Channel[];
  environmental_topics?: string[];
  language?: string;
  verification_status?: string;
  approval_status?: string;
  active?: boolean;
  consent_given?: boolean;
  scopes?: string[];
}

export interface SharedContact {
  id: string;
  display_name: string;
  channel: Channel;
  phone_e164?: string | null;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SharedContactsResponse {
  contacts: SharedContact[];
  limits: {
    max_contacts: number;
    notify_recipients_daily_max: number;
    notify_recipients_sent_today: number;
  };
}

export interface NotificationEntry {
  _id?: string;
  timestamp?: string;
  channel?: string;
  status?: string;
  city?: string;
  alert_level?: string;
  message?: string;
  message_preview?: string;
  error?: string;
  recipient?: string;
  type?: string;
}

export interface NotificationInbox {
  entries: NotificationEntry[];
  total: number;
  count?: number;
  limit?: number;
  skip?: number;
}

export interface ActionLogEntry {
  _id: string;
  action_type: string;
  details?: string | null;
  facility_id: string;
  facility_name?: string | null;
  facility_site?: string | null;
  city?: string | null;
  timestamp?: string;
}

export interface ActionLogResponse {
  facility_id: string;
  count: number;
  entries: ActionLogEntry[];
}

export interface ReverificationDetail {
  error: "reverification_required";
  requires_password_change: boolean;
  message: string;
  code_ttl_minutes?: number;
  code_already_sent?: boolean;
  warnings?: string[];
}

export class AccountApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
    readonly retryAfter?: string | null,
  ) {
    super(message);
    this.name = "AccountApiError";
  }
}

async function accountRequest<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: Record<string, unknown> },
): Promise<T> {
  try {
    return await browserApi<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError) {
      const payload = error.payload as { detail?: unknown } | undefined;
      throw new AccountApiError(error.message, error.status, payload?.detail);
    }
    throw error;
  }
}

export const accountApi = {
  login: (body: {
    email: string;
    password: string;
    reverification_code?: string;
    new_password?: string;
  }) =>
    accountRequest<{
      authenticated?: boolean;
      access_token?: string;
      name?: string;
      email?: string;
    }>("/api/auth/login", { method: "POST", body }),
  requestFacilityOtp: (body: { email: string }) =>
    accountRequest<{
      success: boolean;
      message: string;
      code_ttl_minutes?: number;
    }>("/api/auth/facility-login", { method: "POST", body }),
  exchangeFacilityOtp: (body: { email: string; code: string }) =>
    accountRequest<{
      authenticated?: boolean;
      access_token?: string;
      name?: string;
      email?: string;
    }>("/api/auth/facility-token", { method: "POST", body }),
  verifyRegistration: (body: { email: string; verification_code: string }) =>
    accountRequest<{ success: boolean; message?: string }>(
      "/api/contacts/verify-with-email",
      { method: "POST", body },
    ),
  logout: () =>
    accountRequest<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
    }),
  profile: () => accountRequest<AccountProfile>("/api/auth/profile"),
  patchPreferences: (body: {
    preferred_channels?: Channel[];
    consent_given?: boolean;
    environmental_topics?: string[];
    add_facility_name?: string;
    facility_site_pm25_thresholds?: Record<string, number>;
  }) =>
    accountRequest<{
      success: boolean;
      message?: string;
      profile?: AccountProfile;
    }>("/api/auth/preferences", { method: "PATCH", body }),
  notifications: (limit: number, skip: number) =>
    accountRequest<NotificationInbox>(
      `/api/auth/notification-inbox?limit=${limit}&skip=${skip}`,
    ),
  contacts: () =>
    accountRequest<SharedContactsResponse>("/api/auth/shared-contacts"),
  createContact: (body: Omit<SharedContact, "id">) =>
    accountRequest<{ success: boolean; contact: SharedContact }>(
      "/api/auth/shared-contacts",
      { method: "POST", body },
    ),
  updateContact: (id: string, body: Omit<SharedContact, "id">) =>
    accountRequest<{ success: boolean; contact: SharedContact }>(
      `/api/auth/shared-contacts/${encodeURIComponent(id)}`,
      { method: "PATCH", body },
    ),
  deleteContact: (id: string) =>
    accountRequest<{ success: boolean; deleted_id: string }>(
      `/api/auth/shared-contacts/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
  notifyContacts: (body: {
    contact_ids: string[];
    message: string;
    confirm_recipients_consented: true;
  }) =>
    accountRequest<{
      success: boolean;
      results: Array<{
        contact_id: string;
        ok: boolean;
        error?: string | null;
      }>;
      daily_cap: number;
      sent_today_before: number;
    }>("/api/auth/shared-contacts/notify", {
      method: "POST",
      body,
    }),
  actionLogs: () =>
    accountRequest<ActionLogResponse>("/api/action-log/me?limit=50"),
  createAction: (body: {
    action_type: string;
    details: string;
    facility_site?: string;
  }) =>
    accountRequest<{
      success: boolean;
      id: string;
      facility_id: string;
      facility_site?: string | null;
    }>("/api/action-log", { method: "POST", body }),
  deleteAccount: (body: { password: string; confirm: "DELETE" }) =>
    accountRequest<{ success: boolean; message: string }>(
      "/api/auth/delete-account",
      { method: "POST", body },
    ),
  requestPasswordReset: (body: { email: string }) =>
    accountRequest<{
      success: boolean;
      message?: string;
      code_ttl_minutes?: number;
      warnings?: string[];
    }>("/api/auth/forgot-password/request", { method: "POST", body }),
  confirmPasswordReset: (body: {
    email: string;
    code: string;
    new_password: string;
  }) =>
    accountRequest<{ success: boolean; message?: string }>(
      "/api/auth/forgot-password/confirm",
      { method: "POST", body },
    ),
};
