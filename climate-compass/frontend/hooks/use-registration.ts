"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApi } from "@/lib/api/browser";
import type { CitiesResponse } from "@/lib/api/types";
import type { RegistrationParsed } from "@/validation/registration";
import { toRegistrationPayload } from "@/validation/registration";

export type RegistrationResult = {
  success?: boolean;
  message?: string;
  contact_id?: string;
  verification_resent?: boolean;
  warnings?: string[];
};

export type DirectoryContact = {
  name?: string;
  email?: string;
  phone_number?: string;
  whatsapp_number?: string;
  contact_type?: string;
  environmental_topics?: string[];
  cities?: string[];
  city?: string;
  facility_names?: string[];
  facility_name?: string;
  facility_id?: string;
  verification_status?: string;
  approval_status?: string;
};

export type DevResetAvailability = {
  enabled: boolean;
  confirmation_phrase?: string;
  collections?: string[];
};

export function useRegistration() {
  const [cities, setCities] = useState<CitiesResponse | null>(null);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [devReset, setDevReset] = useState<DevResetAvailability | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      browserApi<CitiesResponse>("api/cities").then((result) => {
        if (active) setCities(result);
      }),
      browserApi<DevResetAvailability>(
        "api/contacts/dev/reset-registration-available",
      ).then((result) => {
        if (active) setDevReset(result);
      }),
    ]).finally(() => {
      if (active) setCitiesLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback((values: RegistrationParsed) => {
    return browserApi<RegistrationResult>("api/contacts/register", {
      method: "POST",
      body: toRegistrationPayload(values),
    });
  }, []);

  const verify = useCallback(
    (input: { email?: string; contactId?: string; code: string }) => {
      if (input.email) {
        return browserApi<{ success?: boolean; message?: string }>(
          "api/contacts/verify-with-email",
          {
            method: "POST",
            body: {
              email: input.email.trim(),
              verification_code: input.code.trim(),
            },
          },
        );
      }
      return browserApi<{ success?: boolean; message?: string }>(
        "api/contacts/verify",
        {
          method: "POST",
          body: {
            contact_id: input.contactId?.trim() || "",
            verification_code: input.code.trim(),
          },
        },
      );
    },
    [],
  );

  const resend = useCallback((email: string) => {
    return browserApi<RegistrationResult>("api/contacts/resend-verification", {
      method: "POST",
      body: { email: email.trim() },
    });
  }, []);

  const loadDirectory = useCallback(
    (passphrase: string, unmaskedPhones: boolean) =>
      browserApi<{ count: number; contacts: DirectoryContact[] }>(
        `api/contacts/directory?unmasked_phones=${unmaskedPhones}`,
        {
          headers: {
            "X-Registration-Directory-Secret": passphrase,
            Authorization: `Bearer ${passphrase}`,
          },
        },
      ),
    [],
  );

  const resetTestData = useCallback(
    (confirmationPhrase: string, apiKey?: string) =>
      browserApi<{
        message?: string;
        contacts_deleted?: number;
        consent_records_deleted?: number;
      }>("api/contacts/dev/reset-registration-test-data", {
        method: "POST",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        body: { confirmation_phrase: confirmationPhrase },
      }),
    [],
  );

  return {
    cities,
    citiesLoading,
    devReset,
    loadDirectory,
    register,
    resend,
    resetTestData,
    verify,
  };
}
