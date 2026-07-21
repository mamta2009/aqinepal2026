import { apiClient } from "./client";

import type {
  ContactRegisterResponse,
  ContactRegistrationPayload,
  ResendVerificationPayload,
  ResendVerificationResponse,
  VerifyContactPayload,
  VerifyResponse,
  VerifyWithEmailPayload,
} from "@/types/contacts";

export async function registerContact(
  payload: ContactRegistrationPayload,
): Promise<ContactRegisterResponse> {
  const { data } = await apiClient.post<ContactRegisterResponse>(
    "/api/contacts/register",
    payload,
  );
  return data;
}

export async function verifyWithEmail(
  payload: VerifyWithEmailPayload,
): Promise<VerifyResponse> {
  const { data } = await apiClient.post<VerifyResponse>(
    "/api/contacts/verify-with-email",
    payload,
  );
  return data;
}

export async function verifyContact(
  payload: VerifyContactPayload,
): Promise<VerifyResponse> {
  const { data } = await apiClient.post<VerifyResponse>(
    "/api/contacts/verify",
    payload,
  );
  return data;
}

export async function resendVerification(
  payload: ResendVerificationPayload,
): Promise<ResendVerificationResponse> {
  const { data } = await apiClient.post<ResendVerificationResponse>(
    "/api/contacts/resend-verification",
    payload,
  );
  return data;
}
