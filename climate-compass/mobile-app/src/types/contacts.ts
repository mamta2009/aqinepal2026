import type {
  ContactType,
  EnvironmentalTopic,
  NotificationChannel,
} from "./auth";

export interface ContactRegistrationPayload {
  name: string;
  email: string;
  phone_number: string;
  whatsapp_number: string;
  contact_type: ContactType;
  facility_names: string[];
  cities: string[];
  preferred_channels: NotificationChannel[];
  environmental_topics: EnvironmentalTopic[];
  language: string;
  consent_given: boolean;
  password: string;
  school_contact?: string;
  school_address?: string;
  school_information?: string;
}

export interface ContactRegisterResponse {
  success: boolean;
  contact_id: string;
  message: string;
  channels?: string[];
  next_step?: string;
  verification_status?: string;
  verification_resent?: boolean;
  warnings?: string[];
}

export interface VerifyWithEmailPayload {
  email: string;
  verification_code: string;
}

export interface VerifyContactPayload {
  contact_id: string;
  verification_code: string;
}

export interface VerifyResponse {
  success: boolean;
  message: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
  channels?: string[];
  warnings?: string[];
}
