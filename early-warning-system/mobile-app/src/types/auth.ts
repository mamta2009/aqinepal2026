/** Auth / session types mirroring backend login + profile responses. */

export type ContactType = "health_worker" | "parent" | "admin" | "government";

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
}
