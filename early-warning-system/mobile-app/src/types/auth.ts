/** Auth / session types mirroring backend login + profile responses. */

export type ContactType =
  | "health_worker"
  | "parent"
  | "admin"
  | "government"
  | "school_admin";

export type NotificationChannel = "sms" | "whatsapp" | "email";

export type EnvironmentalTopic = "air" | "heat";

export interface AuthClaimsPreview {
  facility_id?: string | null;
  facility_name?: string | null;
  city?: string | null;
  scopes?: string[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scopes?: string[];
  contact_id: string;
  email: string;
  name: string;
  city?: string | null;
  coverage_cities?: string[];
  facility_name?: string | null;
  facility_id?: string | null;
  facility_reporting_ready?: boolean;
}

export interface FacilityTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  contact_id: string;
  facility_id: string;
  facility_name?: string | null;
  city?: string | null;
  coverage_cities?: string[];
  scope?: string;
}

export interface FacilityLoginResponse {
  success: boolean;
  message: string;
  code_ttl_minutes?: number;
  warnings?: string[];
}

export interface AuthProfile {
  _id?: string;
  name?: string;
  email?: string;
  phone_number?: string;
  whatsapp_number?: string;
  contact_type?: ContactType | string;
  cities?: string[];
  city?: string | null;
  facility_names?: string[];
  facility_name?: string | null;
  facility_id?: string | null;
  preferred_channels?: NotificationChannel[] | string[];
  environmental_topics?: EnvironmentalTopic[] | string[];
  language?: string;
  verification_status?: string;
  approval_status?: string;
  active?: boolean;
  facility_reporting_ready?: boolean;
  scopes?: string[];
  facility_site_pm25_thresholds?: Record<string, number>;
  consent_given?: boolean;
  [key: string]: unknown;
}

export interface PreferencesPatch {
  preferred_channels?: NotificationChannel[];
  consent_given?: boolean;
  environmental_topics?: EnvironmentalTopic[];
  add_facility_name?: string;
  facility_site_pm25_thresholds?: Record<string, number>;
}

export interface PreferencesPatchResponse {
  success: boolean;
  message: string;
  profile?: AuthProfile;
}

export interface NotificationInboxEntry {
  timestamp?: string;
  channel?: string;
  status?: string;
  city?: string;
  alert_level?: string;
  hazard_type?: string;
  message?: string;
  message_preview?: string;
  error?: string;
}

export interface NotificationInboxResponse {
  count: number;
  entries: NotificationInboxEntry[];
  total?: number;
  skip?: number;
  limit?: number;
}

export type SharedContactChannel = "sms" | "whatsapp" | "email";

export interface SharedAlertContact {
  id: string;
  display_name: string;
  channel: SharedContactChannel | string;
  phone_e164?: string | null;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SharedContactsLimits {
  max_contacts: number;
  notify_recipients_daily_max: number;
  notify_recipients_sent_today: number;
}

export interface SharedContactsResponse {
  contacts: SharedAlertContact[];
  limits: SharedContactsLimits;
}

export interface SharedContactCreatePayload {
  display_name: string;
  channel: SharedContactChannel;
  phone_e164?: string;
  email?: string;
}

export interface SharedContactUpdatePayload {
  display_name?: string;
  channel?: SharedContactChannel;
  phone_e164?: string | null;
  email?: string | null;
}

export interface SharedContactNotifyPayload {
  contact_ids: string[];
  message: string;
  confirm_recipients_consented: boolean;
}

export interface SharedContactNotifyResult {
  contact_id: string;
  channel?: string;
  ok: boolean;
  error?: string;
}

export interface SharedContactNotifyResponse {
  success: boolean;
  results: SharedContactNotifyResult[];
  daily_cap?: number;
  sent_today_before?: number;
}

export interface ActionLogEntry {
  _id?: string;
  action_type?: string;
  facility_site?: string | null;
  timestamp?: string;
  details?: string | null;
  facility_id?: string;
  facility_name?: string | null;
  city?: string | null;
}

export interface ActionLogListResponse {
  facility_id: string;
  count: number;
  entries: ActionLogEntry[];
}

export interface ActionLogCreatePayload {
  action_type: string;
  details?: string;
  facility_site?: string;
}

export interface ActionLogCreateResponse {
  success: boolean;
  id: string;
  facility_id: string;
  facility_site?: string | null;
}
